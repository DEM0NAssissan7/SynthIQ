import type Meal from "../models/events/meal";
import { PreferencesStore } from "../storage/preferencesStore";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { CalibrationStore } from "../storage/calibrationStore";
import type Session from "../models/session";
import { InsulinVariantStore } from "../storage/insulinVariantStore";
import { RescueVariantStore } from "../storage/rescueVariantStore";
import Insulin from "../models/events/insulin";
import type { InsulinVariant } from "../models/types/insulinVariant";
import { forecastUnits } from "./insulinOptimizer";
import { InsulinRetrospectiveOptimizer } from "./insulinRetrospectiveAnalyzer";

export type InsulinPipelineStep = [string, number];
export type InsulinPipeline = InsulinPipelineStep[];

function getProfileMealRise(carbs: number, protein: number) {
  const carbsRise = carbs * CalibrationStore.carbsEffect.value;
  const proteinRise = protein * CalibrationStore.proteinEffect.value;
  return carbsRise + proteinRise;
}

export function getProfileInsulin(
  carbs: number,
  protein: number,
  variant = InsulinVariantManager.getDefault(),
) {
  return getProfileMealRise(carbs, protein) / variant.effect;
}

function getExtraProfileDelta(
  meal: Meal,
  reference: Session,
): [number, number] {
  const referenceMeal = reference.meal;
  if (!referenceMeal)
    throw new Error(
      `Cannot get extra profile delta: reference session has invalid meal`,
    );

  const mealRise = reference.mealRise;
  const profileMealRise = getProfileMealRise(
    referenceMeal.carbs,
    referenceMeal.protein,
  );
  // Without a usable rise from the reference, the profile can't be rescaled to it
  const profileScale = !Number.isFinite(mealRise)
    ? 1
    : profileMealRise !== 0
      ? mealRise / profileMealRise
      : 0;

  const sharedFoods = meal.foods.filter((f) => referenceMeal.hasFood(f));
  const unsharedFoods = meal.foods.filter((f) => !referenceMeal.hasFood(f));

  const carbsEffect = CalibrationStore.carbsEffect.value;
  const proteinEffect = CalibrationStore.proteinEffect.value;

  let extraCarbsRise = 0;
  let extraProteinRise = 0;

  sharedFoods.forEach((f) => {
    extraCarbsRise += f.netCarbs * carbsEffect * profileScale;
    extraProteinRise += f.protein * proteinEffect * profileScale;
  });
  const [
    unsharedCarbs,
    unsharedProtein,
    unsharedCarbsRise,
    unsharedProteinRise,
  ] = unsharedFoods.reduce(
    (n, f) => [
      n[0] + f.netCarbs,
      n[1] + f.protein,
      n[2] + f.netCarbs * carbsEffect,
      n[3] + f.protein * proteinEffect,
    ],
    [0, 0, 0, 0],
  );
  // totalCarbs = extraSharedCarbs + unsharedCarbs + originalCarbs => extraSharedCarbs = totalCarbs - unsharedCarbs - originalSharedCarbs
  const extraSharedCarbs = meal.carbs - unsharedCarbs - referenceMeal.carbs;
  const extraSharedProtein =
    meal.protein - unsharedProtein - referenceMeal.protein;
  const sharedCarbsRise = extraSharedCarbs * carbsEffect * profileScale;
  const sharedProteinRise = extraSharedProtein * proteinEffect * profileScale;

  return [
    unsharedCarbsRise + sharedCarbsRise,
    unsharedProteinRise + sharedProteinRise,
  ];
}

// The doses the base session "should've" had
function getRetrospectiveInsulins(BG: number | null, baseSession: Session) {
  const [insulins] = InsulinRetrospectiveOptimizer.getOptimalInsulins(
    baseSession.insulins,
    baseSession.snapshot,
    baseSession.glucoses,
    BG,
    PreferencesStore.learningRate.value / 100,
    InsulinVariantStore.variants.value,
    RescueVariantStore.variants.value,
  );
  return insulins;
}

// Spread the rise this meal has over its base session across a plan of doses:
// the carbs go on the first dose, and the protein is shared equally
function getProfileRises(
  meal: Meal,
  baseSession: Session,
  doseCount: number,
): number[] {
  const [extraCarbsRise, extraProteinRise] = getExtraProfileDelta(
    meal,
    baseSession,
  );
  const count = Math.max(doseCount, 1);
  const rises: number[] = new Array(count).fill(extraProteinRise / count);
  rises[0] += extraCarbsRise;
  return rises;
}

// The rise this meal has over its base session, for each dose in the base session's plan
export function getPlannedProfileRises(
  BG: number | null,
  meal: Meal,
  baseSession: Session,
): number[] {
  const plannedDoses = getRetrospectiveInsulins(BG, baseSession);
  return getProfileRises(meal, baseSession, plannedDoses.length);
}

// The ideal doses for this meal: what the base session should've had, adjusted for the differences in food
export function getIdealInsulins(
  BG: number | null,
  meal: Meal,
  baseSession: Session | null,
): Insulin[] {
  if (!baseSession) return [];
  const insulins = getRetrospectiveInsulins(BG, baseSession);
  const rises = getProfileRises(meal, baseSession, insulins.length);
  return insulins
    .map(
      (insulin, i) =>
        new Insulin(
          insulin.value + rises[i] / insulin.variant.effect,
          insulin.timestamp,
          insulin.variant,
        ),
    )
    .filter((insulin) => insulin.value > 0);
}

function finalizePipeline(steps: InsulinPipeline): InsulinPipeline {
  // Get rid of pointless steps
  const pipeline = steps.filter(([, value]) => Math.abs(value) >= 0.1);
  return evaluateInsulinPipeline(pipeline) > 0 ? pipeline : [];
}

/**
 * The dose to take *right now*, broken down into steps. An empty pipeline means no dose is recommended.
 * @param BG Current blood sugar. If null, we assume we're at target
 * @param session The session in progress, or null if the meal hasn't started (pre-bolus)
 */
export function deriveInsulinPipeline(
  BG: number | null,
  meal: Meal,
  baseSession: Session | null,
  baseSessions: Session[],
  session: Session | null,
  variant: InsulinVariant,
  timestamp: Date,
  ...extraElements: InsulinPipelineStep[]
): InsulinPipeline {
  const targetBG = PreferencesStore.targetBG.value;
  const takenInsulins = session?.insulins ?? [];

  if (!baseSession) {
    // With nothing to go off of we can only "best guess" the first dose. We have no
    // way of knowing how much of the meal any insulin already taken has covered.
    if (takenInsulins.length > 0) return [];
    return finalizePipeline([
      ["Meal", getProfileInsulin(meal.carbs, meal.protein, variant)],
      ["Correction", BG ? (BG - targetBG) / variant.effect : 0],
      ...extraElements,
    ]);
  }

  const currentBG = BG ?? targetBG;

  // Shifting both BGs keeps the observed delta (and so the meal's progress) intact
  const forecast = (offset: number) =>
    forecastUnits(
      baseSessions,
      takenInsulins,
      session?.glucoses ?? [],
      currentBG + offset,
      session?.timestamp ?? timestamp,
      timestamp,
      variant,
    );
  const mealInsulin = forecast(targetBG - currentBG);
  const correctionInsulin = forecast(0) - mealInsulin;

  // The forecast only knows about the base session's food, so the difference comes from the planned doses
  const profileRise =
    getPlannedProfileRises(session?.initialGlucose ?? BG, meal, baseSession)[
      takenInsulins.length
    ] ?? 0;

  return finalizePipeline([
    ["Meal", mealInsulin],
    ["Correction", correctionInsulin],
    ["Profile", profileRise / variant.effect],
    ...extraElements,
  ]);
}

export function evaluateInsulinPipeline(pipeline: InsulinPipeline) {
  if (!pipeline || pipeline.length === 0) return 0;
  return pipeline.reduce((n, step) => n + step[1], 0);
}

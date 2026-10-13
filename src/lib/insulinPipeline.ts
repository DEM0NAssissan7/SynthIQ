import type Meal from "../models/events/meal";
import { PreferencesStore } from "../storage/preferencesStore";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { CalibrationStore } from "../storage/calibrationStore";
import type Session from "../models/session";
import { InsulinVariantStore } from "../storage/insulinVariantStore";
import { RescueVariantStore } from "../storage/rescueVariantStore";
import { InsulinOptimizer } from "./insulinOptimizer";
import Insulin from "../models/events/insulin";

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
  const profileScale = mealRise / profileMealRise;

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

// Return an insulin pipeline for every insulin shot we take
export function deriveInsulinPipelines(
  BG: number | null,
  meal: Meal,
  baseSession: Session | null,
  ...extraElements: InsulinPipelineStep[]
): [InsulinPipeline[], Insulin[]] {
  const targetBG = PreferencesStore.targetBG.value;
  // Make the fallback return value
  const fallback: [InsulinPipeline[], Insulin[]] = (() => {
    // If we do not have a base session to go off of, we return a "best guess"
    const variant = InsulinVariantManager.getDefault();
    const mealInsulin = getProfileInsulin(meal.carbs, meal.protein, variant);
    const correctionInsulin = BG ? (BG - targetBG) / variant.effect : 0;
    const fallbackPipeline: InsulinPipeline = [
      ["Meal", mealInsulin],
      ["Correction", correctionInsulin],
      ...extraElements,
    ];
    return [
      [fallbackPipeline],
      [
        new Insulin(
          evaluateInsulinPipeline(fallbackPipeline),
          baseSession?.timestamp ?? new Date(),
          variant,
        ),
      ],
    ];
  })();
  if (!baseSession) {
    return fallback;
  }
  // Setup the pipeline scratchpad
  const pipelines: InsulinPipeline[] = [];

  // Now for the actual derivation
  const [baseOptimalInsulins, _, isolatedMealInsulins] =
    InsulinOptimizer.getOptimalInsulins(
      baseSession.insulins,
      baseSession.snapshot,
      baseSession.glucoses,
      BG,
      PreferencesStore.learningRate.value / 100,
      InsulinVariantStore.variants.value,
      RescueVariantStore.variants.value,
      false,
    );
  if (baseOptimalInsulins.length === 0) return fallback;

  baseOptimalInsulins.forEach((insulin, i) => {
    if (insulin.value < 0.01) return;
    const mealInsulin = isolatedMealInsulins[i];
    const correctionOffset = insulin.value - mealInsulin.value;
    pipelines.push([
      ["Meal", mealInsulin.value],
      ["Correction", correctionOffset],
    ]);
  });

  // We try to make a "best guess" as to where the meal *should* land
  const prunedInsulins = InsulinOptimizer.pruneInsulins(baseOptimalInsulins);
  const [extraCarbsRise, extraProteinRise] = getExtraProfileDelta(
    meal,
    baseSession,
  );
  let profileOffsets = prunedInsulins.map((_) => 0);
  profileOffsets[0] = extraCarbsRise / prunedInsulins[0].variant.effect;
  const extraProteinRisePerShot = extraProteinRise / prunedInsulins.length;
  // Distribute protein out equally for each shot
  prunedInsulins.forEach(
    (insulin, i) =>
      (profileOffsets[i] += extraProteinRisePerShot / insulin.variant.effect),
  );

  pipelines.forEach((shot, i) => {
    shot.push(["Profile", profileOffsets[i]]);
  });

  // Finally, add extra steps
  pipelines.forEach((steps) => steps.push(...extraElements));

  // Composite into insulins
  const compositeInsulins = prunedInsulins.map(
    (insulin, i) =>
      new Insulin(
        evaluateInsulinPipeline(pipelines[i]),
        insulin.timestamp,
        insulin.variant,
      ),
  );

  return [pipelines, compositeInsulins];
}

export function evaluateInsulinPipeline(pipeline: InsulinPipeline) {
  if (!pipeline || pipeline.length === 0) return 0;
  return pipeline.reduce((n, step) => n + step[1], 0);
}

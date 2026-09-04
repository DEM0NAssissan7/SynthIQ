import { InsulinVariantManager } from "../managers/insulinVariantManager";
import type Insulin from "../models/events/insulin";
import type { InsulinVariant } from "../models/types/insulinVariant";
import type { RescueVariant } from "../models/types/rescueVariant";
import type SugarReading from "../models/types/sugarReading";
import { CalibrationStore } from "../storage/calibrationStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { WizardStore } from "../storage/wizardStore";
import { estimateDynamicISF } from "./helpers/estimateDynamicISF";
import { getTimestampFromOffset } from "./timing";

// Insulin
export function getCorrectionInsulin(glucose: number, variant: InsulinVariant) {
  return Math.max(
    (glucose - PreferencesStore.targetBG.value) / variant.effect,
    0,
  );
}
export function getOvercompensationInsulins(
  glucose: number,
  variants: InsulinVariant[],
): number[] {
  let insulins: number[] = [];
  const BGOffsetPerShot =
    Math.max(
      Math.min(glucose - PreferencesStore.targetBG.value, 0) +
        PreferencesStore.overshootOffset.value,
      0,
    ) / variants.length;
  for (const v of variants) {
    const insulin = BGOffsetPerShot / v.effect;
    insulins.push(insulin);
  }
  return insulins;
}

// Glucose
export function getGlucoseCorrectionCaps(
  sugar: number,
  variant: RescueVariant,
  allowNegative = false,
) {
  const correction = (PreferencesStore.targetBG.value - sugar) / variant.effect;
  if (allowNegative) return correction;
  return Math.max(correction, 0);
}
export function getIntelligentGlucoseCorrection(
  velocityHours: number, // User BG Velocity in pts/hr
  currentBG: number,
  actingMinutes: number, // How far to look in the future
  variant: RescueVariant,
  readings: SugarReading[],
  insulinsOnBoard: Insulin[],
) {
  /**
   * We consider the current BG velocity to last another 'actingMinutes' minutes (i.e. the max duration it takes for a rescue dose takes to work).
   * As in, the current BG effect from the velocity will last another 30 minutes.
   * For example, if the sugar is moving at a rate of 30 mg/dL per hr, we assume it's gonna
   * end up going down by 15mg/dL (30 minutes = 1/2 hour), so we add that into the
   */
  const velocity = velocityHours / 60;
  const velocityHorizon = Math.min(actingMinutes, 30);
  const velocityPredictedDrop = velocity * velocityHorizon;

  const dynamicISF = estimateDynamicISF(readings, insulinsOnBoard);
  const now = new Date();
  const future = getTimestampFromOffset(now, actingMinutes / 60);
  const insulinPredictedDrop = insulinsOnBoard.reduce(
    (n, insulin) => n - insulin.batemanIntegral(now, future) * dynamicISF,
    0,
  );

  // Choose the largest drop as the safest bet for the user if we are dropping
  // If we are rising, have the rise counteract the predicted drop from insulin
  const predictedDrop =
    velocity < 0
      ? Math.min(velocityPredictedDrop, insulinPredictedDrop)
      : velocityPredictedDrop + insulinPredictedDrop;

  return getGlucoseCorrectionCaps(currentBG + predictedDrop, variant); // We add predictedDrop because if the sugar is dropping, the velocity will be negative (along with predictedDrop being negative too)
}

// Basal
/**
 * velocity: (mg/dL) / hr
 */
export function getBasalCorrection(velocity: number): number {
  const basalVelocityEffect = InsulinVariantManager.getBasalVariant().effect; // [(mg/dL) per hour] / unit
  return velocity / basalVelocityEffect;
}

export function getApproximatedProfile() {
  const templates = WizardStore.templates.value;

  // The alpha is basically a gradient descent from the general profile
  let alphaCarbs = CalibrationStore.carbsEffect.value;
  let alphaProtein = CalibrationStore.proteinEffect.value;

  const baseLearningRate = 0.00001;

  // Don't allow less than 3 valid sessions before making any conclusions
  for (let template of templates) {
    const validSessions = template.validSessions;
    for (let i = validSessions.length - 1; i >= 0; i--) {
      const session = validSessions[i];
      const eta = baseLearningRate;

      const predictedMealRise =
        alphaCarbs * session.carbs + alphaProtein * session.protein;
      const actualMealRise = session.mealRise;
      if (Number.isNaN(actualMealRise)) continue;
      const error = predictedMealRise - actualMealRise;

      alphaCarbs -= eta * error * session.carbs;
      alphaProtein -= eta * error * session.protein;
    }
  }

  return {
    carbsEffect: alphaCarbs,
    proteinEffect: alphaProtein,
  };
}

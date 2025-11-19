import type { InsulinVariant } from "../models/types/insulinVariant";
import type { RescueVariant } from "../models/types/rescueVariant";
import { CalibrationStore } from "../storage/calibrationStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { WizardStore } from "../storage/wizardStore";

// Insulin
export function getCorrectionInsulin(glucose: number, variant: InsulinVariant) {
  return Math.max(
    (glucose - PreferencesStore.targetBG.value) / variant.effect,
    0
  );
}
export function getOvercompensationInsulins(
  glucose: number,
  variants: InsulinVariant[]
): number[] {
  let insulins: number[] = [];
  const BGOffsetPerShot =
    Math.max(
      Math.min(glucose - PreferencesStore.targetBG.value, 0) +
        PreferencesStore.overshootOffset.value,
      0
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
  variant: InsulinVariant,
  allowNegative = false
) {
  const correction = (PreferencesStore.targetBG.value - sugar) / variant.effect;
  if (allowNegative) return correction;
  return Math.max(correction, 0);
}
export function getIntelligentGlucoseCorrection(
  velocityHours: number,
  currentBG: number,
  actingMinutes: number,
  variant: RescueVariant
) {
  /**
   * We consider the current BG velocity to last another 30 minutes.
   * As in, the current BG effect from the velocity will last another 30 minutes.
   * For example, if the sugar is moving at a rate of 30 mg/dL per hr, we assume it's gonna
   * end up going down by 15mg/dL (30 minutes = 1/2 hour), so we add that into the
   */
  const velocityMinutes = velocityHours / 60;
  const predictedDrop = velocityMinutes * actingMinutes;
  return getGlucoseCorrectionCaps(currentBG + predictedDrop, variant); // We add predictedDrop because if the sugar is dropping, the velocity will be negative (along with predictedDrop being negative too)
}

// Basal
/**
 * velocity: (mg/dL) / hr
 */
export function getBasalCorrection(velocity: number): number {
  const basalVelocityEffect = CalibrationStore.basalEffect.value; // [(mg/dL) per hour] / unit
  return velocity / basalVelocityEffect;
}

export function getApproximatedProfile() {
  const templates = WizardStore.templates.value;

  // The alpha is basically a gradient descent from the general profile
  let alphaCarbs = CalibrationStore.carbsEffect.value;
  let alphaProtein = CalibrationStore.proteinEffect.value;

  const baseLearningRate = 0.0001;

  // Don't allow less than 3 valid sessions before making any conclusions
  for (let template of templates) {
    const validSessions = template.validSessions;
    for (let i = validSessions.length - 1; i >= 0; i--) {
      const session = validSessions[i];
      const eta = baseLearningRate;

      const predictedMealRise =
        alphaCarbs * session.carbs + alphaProtein * session.protein;
      const actualMealRise = session.mealRise;
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

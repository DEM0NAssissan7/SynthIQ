import type Session from "../models/session";
import { profile } from "../storage/metaProfileStore";
import basalStore from "../storage/basalStore";

// Insulin
export function getInsulin(carbs: number, protein: number) {
  return (
    (carbs * profile.carbs.effect + protein * profile.protein.effect) /
    profile.insulin.effect
  );
}
export function getCorrectionInsulin(glucose: number) {
  return Math.max((glucose - profile.target) / profile.insulin.effect, 0);
}
export function getSessionMealInsulin(session: Session) {
  return session.insulin - getCorrectionInsulin(session.initialGlucose);
}

// Glucose
export function getGlucoseCorrectionCaps(sugar: number) {
  return Math.max((profile.target - sugar) / profile.glucose.effect, 0);
}
export function getIntelligentGlucoseCorrection(
  velocityHours: number,
  currentBG: number,
  actingMinutes: number
) {
  /**
   * We consider the current BG velocity to last another 30 minutes.
   * As in, the current BG effect from the velocity will last another 30 minutes.
   * For example, if the sugar is moving at a rate of 30 mg/dL per hr, we assume it's gonna
   * end up going down by 15mg/dL (30 minutes = 1/2 hour), so we add that into the
   */
  const velocityMinutes = velocityHours / 60;
  const predictedDrop = velocityMinutes * actingMinutes;
  return getGlucoseCorrectionCaps(currentBG + predictedDrop); // We add predictedDrop because if the sugar is dropping, the velocity will be negative (along with predictedDrop being negative too)
}

// Basal
/**
 * velocity: (mg/dL) / hr
 */
export function getBasalCorrection(velocity: number): number {
  const basalVelocityEffect = basalStore.get("basalEffect"); // [(mg/dL) per hour] / unit
  return velocity / basalVelocityEffect;
}

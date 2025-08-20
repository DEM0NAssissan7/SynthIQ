import Insulin from "../models/events/insulin";
import type Session from "../models/session";
import { CalibrationStore } from "../storage/calibrationStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { timestampIsBetween } from "./timing";

// Insulin
export function getInsulin(carbs: number, protein: number) {
  return (
    (carbs * CalibrationStore.carbsEffect.value +
      protein * CalibrationStore.proteinEffect.value) /
    CalibrationStore.insulinEffect.value
  );
}
export function getCorrectionInsulin(glucose: number) {
  return Math.max(
    (glucose - PreferencesStore.targetBG.value) /
      CalibrationStore.insulinEffect.value,
    0
  );
}
export function getSessionMealInsulin(session: Session) {
  if (!session.initialGlucose)
    throw new Error(`Cannot get session meal insulin: no initial glucose`);
  return session.insulin - getCorrectionInsulin(session.initialGlucose);
}

// Glucose
export function getGlucoseCorrectionCaps(sugar: number) {
  return Math.max(
    (PreferencesStore.targetBG.value - sugar) /
      CalibrationStore.glucoseEffect.value,
    0
  );
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
  const basalVelocityEffect = CalibrationStore.basalEffect.value; // [(mg/dL) per hour] / unit
  return velocity / basalVelocityEffect;
}

// Multi Bolus
export function getOptimalMealInsulins(session: Session): Insulin[] {
  /**
   * The rationale here is we basically create little windows of time
   * Each bolus shot creates a new window
   * A window contains the following info:
   *
   * InitialBG
   * Insulin amount taken
   * Glucose amount taken
   * FinalBG
   *
   * The algorithm is pretty simple. We adjust for the change in BG (accounting for glucose rise).
   * And it implicitly subtracts whatever correction insulin was taken because it attempts
   * to correct for it.
   *
   * For the first insulin, we subtract the insulin taken to correct for the current BG
   * because this function only wants to return the optimal MEAL insulin, not cumUlative.
   */

  const snapshots = session.snapshots;
  const insulins = session.insulins;
  const glucoses = session.glucoses;

  if (!session.initialGlucose)
    throw new Error(`Cannot determine insulin amount: no initial BG`);

  type TreatmentWindow = {
    initialBG: number;
    insulin: number;
    glucose: number;
    finalBG: number;
  };

  // Treatment windows creation
  let windows: TreatmentWindow[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const insulin = insulins[i];
    if (!snapshot.finalBG || !snapshot.initialBG)
      throw new Error(
        `Cannot reliably dictate insulin dosing: no final or inital BG`
      );
    const window: TreatmentWindow = {
      initialBG: snapshot.initialBG.sugar,
      insulin: insulin.value,
      finalBG: snapshot.finalBG.sugar,
      glucose: 0,
    };
    // We account for glucose taken within the time frame and subtract it from the final sugar to see what it would be without any adjustment
    for (let glucose of glucoses) {
      if (
        timestampIsBetween(
          glucose.timestamp,
          snapshot.initialBG.timestamp,
          snapshot.finalBG.timestamp
        )
      ) {
        // If the glucose was taken during this window
        window.glucose += glucose.value;
      }
    }
    windows.push(window);
  }
  /**
   * Now that we have a list of the theoretical finalBGs, we can adjust each on to try and get a zero-change scenario
   */
  for (let window of windows) {
    const glucoseRise = window.glucose * session.glucoseEffect;
    const theoreticalFinalBG = window.finalBG - glucoseRise; // Avoid blaming glucose for a rise in BG
    const deltaBG = theoreticalFinalBG - window.initialBG; // Try to keep things as flat as possible

    const correction = deltaBG / session.insulinEffect;
    window.insulin += correction;
  }

  let resultInsulins: Insulin[] = [];
  for (let i = 0; i < insulins.length; i++) {
    const _insulin = insulins[i];
    const window = windows[i];
    const insulin = Insulin.deserialize(Insulin.serialize(_insulin));
    insulin.value =
      window.insulin *
      (session.insulinEffect / CalibrationStore.insulinEffect.value); // Scale the window's insulin by the ratio between our current ISF and the ISF when the meal was eaten
    resultInsulins.push(insulin);
  }

  return resultInsulins;
}

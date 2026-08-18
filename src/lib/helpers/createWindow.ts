import Glucose from "../../models/events/glucose";
import Insulin from "../../models/events/insulin";
import Snapshot from "../../models/snapshot";
import type { TreatmentWindow } from "../../models/types/treatmentWindow";
import { timestampIsBetween } from "../timing";

/**
 * Returns an array equal in length to insulins that details what was actually absorbed in that time
 */
export function morphInsulins(
  _insulins: Insulin[],
  timeA: Date,
  timeB: Date,
): Insulin[] {
  const insulins = _insulins.map((i) =>
    Insulin.deserialize(Insulin.serialize(i)),
  );
  // Find optimal variant
  insulins.forEach((i) => (i.value = i.batemanIntegral(timeA, timeB)));
  return insulins;
}
/**
 *
 * @param insulins The insulins taken in general
 * @param snapshots The snapshots corresponding to each insulin. Note: MUST be the same length as _insulins
 * @param glucoses Glucoses taken
 * @returns
 */
export function createWindows(
  insulins: Insulin[],
  _snapshot: Snapshot,
  glucoses: Glucose[],
): TreatmentWindow[] {
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

  if (insulins.length === 0 || !_snapshot.hasCalibrations) return [];

  // Treatment windows creation
  const windows: TreatmentWindow[] = [];
  for (let i = 0; i < insulins.length; i++) {
    const insulin = insulins[i];
    const nextInsulin = insulins[i + 1];
    if (!insulin) continue;

    const snapshot: Snapshot | null = nextInsulin
      ? _snapshot.looseView(insulin.timestamp, nextInsulin.timestamp)
      : _snapshot.looseView(insulin.timestamp, _snapshot.endTime);
    /*console.log(
      `${i + 1} / ${insulins.length}`,
      snapshot,
      insulin,
      nextInsulin,
    );*/
    if (!snapshot) continue;
    if (!snapshot.finalBG || !snapshot.initialBG) continue;
    if (snapshot.length <= 0) continue;
    const morphedInsulins = morphInsulins(
      insulins,
      snapshot.startTime,
      snapshot.endTime,
    );
    const window: TreatmentWindow = {
      snapshot: snapshot,
      initialBG: snapshot.initialBG.sugar,
      startTime: snapshot.startTime,
      insulins: morphedInsulins,
      finalBG: snapshot.finalBG.sugar,
      endTime: snapshot.endTime,
      length: snapshot.length,
      glucoses: [],
    };
    // We account for glucose taken within the time frame and subtract it from the final sugar to see what it would be without any adjustment
    for (let glucose of glucoses) {
      if (
        timestampIsBetween(
          glucose.timestamp,
          snapshot.initialBG.timestamp,
          snapshot.finalBG.timestamp,
        )
      ) {
        // If the glucose was taken during this window
        window.glucoses.push(Glucose.deserialize(Glucose.serialize(glucose)));
      }
    }

    windows.push(window);
  }
  return windows;
}

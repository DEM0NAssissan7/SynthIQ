import Glucose from "../../models/events/glucose";
import Insulin from "../../models/events/insulin";
import type Snapshot from "../../models/snapshot";
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
 * @param _insulins The insulins taken in general
 * @param snapshots The snapshots corresponding to each insulin. Note: MUST be the same length as _insulins
 * @param glucoses Glucoses taken
 * @returns
 */
export function createWindows(
  _insulins: Insulin[],
  snapshots: Snapshot[],
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

  if (_insulins.length === 0) return [];

  // Treatment windows creation
  let windows: TreatmentWindow[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    if (!snapshot.finalBG || !snapshot.initialBG)
      throw new Error(`Cannot create windows: no final or inital BG`);
    const insulins = morphInsulins(
      _insulins,
      snapshot.startTime,
      snapshot.endTime,
    );
    const window: TreatmentWindow = {
      snapshot: snapshot,
      initialBG: snapshot.initialBG.sugar,
      startTime: snapshot.startTime,
      insulins: insulins,
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

import Insulin from "../../models/events/insulin";
import type { TreatmentWindow } from "../../models/types/treatmentWindow";
import { InsulinVariant } from "../../models/types/insulinVariant";
import { RescueVariant } from "../../models/types/rescueVariant";
import { useVariantGetters } from "./useVariantGetters";
import { PreferencesStore } from "../../storage/preferencesStore";
import Glucose from "../../models/events/glucose";
import Snapshot from "../../models/snapshot";
import { morphInsulins } from "./createWindow";
import { convertDimensions } from "../util";
import Unit from "../../models/unit";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";

export namespace InsulinOptimizer {
  // Helpers
  function insulinsDeepCopy(insulins: Insulin[]) {
    return insulins.map((i) => Insulin.deserialize(Insulin.serialize(i)));
  }
  function glucosesDeepCopy(glucoses: Glucose[]) {
    return glucoses.map((g) => Glucose.deserialize(Glucose.serialize(g)));
  }
  function snapshotDeepCopy(snapshot: Snapshot): Snapshot {
    return Snapshot.deserialize(Snapshot.serialize(snapshot));
  }
  function windowsDeepCopy(windows: TreatmentWindow[]): TreatmentWindow[] {
    return windows.map((window) => {
      return {
        snapshot: snapshotDeepCopy(window.snapshot),
        initialBG: window.initialBG,
        startTime: window.startTime,
        insulins: insulinsDeepCopy(window.insulins),
        glucoses: glucosesDeepCopy(window.glucoses),
        finalBG: window.finalBG,
        endTime: window.endTime,
        length: window.length,
      };
    });
  }

  function remorph(windows: TreatmentWindow[], insulins: Insulin[]) {
    // Now we remorph the insulins so the new window reflects the theoretical adjustment
    windows.forEach((window) => {
      window.insulins = morphInsulins(
        insulins,
        window.startTime,
        window.endTime,
      );
    });
  }
  /**
   * Adjust the dosing in insulins to be as mathematically sound as possible without modifying
   * @param _insulins The insulins we want to optimize
   * @param windows Treatment windows (complimentary to insulins)
   * @param upTo The index to balance up to
   * @param insulinVariants All insulin variants able to query
   * @param rescueVariants All rescue variants able to query
   * @returns An array of Insulin[] and Windows[] equal in size to input, but all doses have been adjusted
   */
  function balance(
    insulins: Insulin[],
    windows: TreatmentWindow[],
    getInsulinVariant: (variant: InsulinVariant) => InsulinVariant,
    getRescueVariant: (variant: RescueVariant) => RescueVariant,
  ): [Insulin[], TreatmentWindow[]] {
    if (windows.length === 0 || insulins.length === 0) return [[], []];

    // Save the original values
    const originalInsulinValues = insulins.map((insulin) => insulin.value);
    // Initialize all insulins to zero
    insulins.forEach((insulin) => (insulin.value = 0));
    // Proceed through the windows procedurally
    for (let i = 0; i < Math.min(windows.length, insulins.length); i++) {
      const window = windows[i];
      const insulin = insulins[i];
      if (!insulin || !insulin.variant) continue;

      const glucoseEffect = window.glucoses.reduce(
        (n, g) => g.value * getRescueVariant(g.variant).effect + n,
        0,
      );

      // We get rid of the theoretical effect of glucose, so the window is no longer considering them (theoretical)
      window.finalBG -= glucoseEffect;
      window.glucoses = [];
      // This deltaBG is our needed adjustment budget for the window
      const deltaBG = window.finalBG - window.initialBG;
      // totalDeltaInsulin -> the total amount of insulin we need to absorb in THAT window
      // to get the optimal correction
      const totalDeltaInsulin =
        deltaBG / getInsulinVariant(insulin.variant).effect;
      // insulinEffectRatio -> the fraction of insulin from the window's shot that was absorbed in its timeframe
      const insulinEffectRatio = getInsulinVariant(
        insulin.variant,
      ).unitBatemanIntegral(0, window.length);
      const deltaInsulin = totalDeltaInsulin / insulinEffectRatio;
      // Apply it to our model
      insulin.value = deltaInsulin;
      // Now that the theoretical insulin is applied, we modify the
      // theoretical windows accordingly
      // Remorph to readjust all windows' partial insulin change distributions
      remorph(windows, insulins);
      // Now we go through all future windows and make theoretical adjustments to their
      // blood sugars
      for (let j = i; j < windows.length; j++) {
        const window = windows[j];
        let totalInsulinEffect = 0;
        for (let k = i; k < window.insulins.length; k++) {
          const insulin = window.insulins[k];
          if (!insulin || !insulin.variant) continue;
          totalInsulinEffect +=
            getInsulinVariant(insulin.variant).effect * insulin.value;
        }
        window.finalBG -= totalInsulinEffect;
        if (j < windows.length - 1)
          windows[j + 1].initialBG -= totalInsulinEffect;
      }
    }
    // Apply changes to insulins
    insulins.forEach((insulin, i) => {
      if (originalInsulinValues[i]) insulin.value += originalInsulinValues[i];
    });
    return [insulins, windows];
  }
  function needsAdditionalDose(
    window: TreatmentWindow,
    getRescueVariant: (variant: RescueVariant) => RescueVariant,
  ) {
    const glucoseEffect = window.glucoses.reduce(
      (n, glucose) =>
        n + glucose.value * getRescueVariant(glucose.variant).effect,
      0,
    );
    return (
      window.finalBG >= PreferencesStore.highBG.value &&
      glucoseEffect >= window.initialBG - PreferencesStore.lowBG.value
    );
  }
  /**
   * This is basically window mitosis
   * Every element of a window needs to be duplicated and adjusted evenly
   */
  function split(
    newInsulins: Insulin[],
    window: TreatmentWindow,
    timestamp: Date,
  ): [TreatmentWindow, TreatmentWindow] {
    // Find the affected window we are targeting
    if (!window.snapshot.contains(timestamp))
      throw new Error(
        `Cannot split: timestamp ${timestamp} is not contained in any windows`,
      );

    // We figure out which glucoses belong to A and which belong to B
    const glucosesA: Glucose[] = window.glucoses.filter(
      (glucose) => glucose.timestamp.getTime() < timestamp.getTime(),
    );
    const glucosesB: Glucose[] = window.glucoses.filter(
      (glucose) => glucose.timestamp.getTime() >= timestamp.getTime(),
    );

    // Now for the magic
    const timestampA = window.startTime;
    const timestampB = window.endTime;
    const splitBG = window.snapshot.getReading(timestamp).sugar;

    // Create windows
    const snapshotA = window.snapshot.view(timestampA, timestamp);
    const snapshotB = window.snapshot.view(timestamp, timestampB);
    const windowA: TreatmentWindow = {
      snapshot: snapshotA,
      initialBG: window.initialBG,
      startTime: timestampA,
      insulins: morphInsulins(newInsulins, timestampA, timestamp),
      glucoses: glucosesA,
      finalBG: splitBG,
      endTime: timestamp,
      length: snapshotA.length,
    };
    const windowB: TreatmentWindow = {
      snapshot: snapshotB,
      initialBG: splitBG,
      startTime: timestamp,
      insulins: morphInsulins(newInsulins, timestamp, timestampB),
      glucoses: glucosesB,
      finalBG: window.finalBG,
      endTime: timestampB,
      length: snapshotB.length,
    };

    return [windowA, windowB];
  }

  export function getOptimalInsulins(
    _insulins: Insulin[],
    windows: TreatmentWindow[],
    insulinVariants: InsulinVariant[],
    rescueVariants: RescueVariant[],
  ): Insulin[] {
    const { getInsulinVariant, getRescueVariant } = useVariantGetters(
      insulinVariants,
      rescueVariants,
    );
    // Create a deep copy of insulins
    let insulins = insulinsDeepCopy(_insulins);
    // Phase 1: Figure out where to put new splits
    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      if (!needsAdditionalDose(window, getRescueVariant)) continue;

      // Now that we know it needs a new dose, we need to make sure
      // It's possible to actually add a dose where we need it

      // Redundant precaution
      if (window.glucoses.length === 0) continue;
      // Get the last glucose that was taken
      const lastGlucose = window.glucoses.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      )[0];
      // We set the new dose to be the last taken glucose + its duration as a buffer
      const newDoseTimestamp = new Date(
        lastGlucose.timestamp.getTime() +
          getRescueVariant(lastGlucose.variant).duration *
            convertDimensions(Unit.Time.Minute, Unit.Time.Millis),
      );
      // If the window doesn't contain it, we can't add it - skip
      if (!window.snapshot.contains(newDoseTimestamp)) continue;
      // We splice in a phantom 0-dose insulin for windowB (because in reality, 0 units of insulin were taken here)
      // (we want to have the balancer optimize for if we placed a new dose here)
      insulins.splice(
        i + 1,
        0,
        new Insulin(0, newDoseTimestamp, InsulinVariantManager.getDefault()),
      );
      // Split the window into two, replace & splice
      const [windowA, windowB] = split(insulins, window, newDoseTimestamp);
      windows[i] = windowA;
      windows.splice(i + 1, 0, windowB);
      // Skip the window we just added
      i++;
    }

    // Phase 2: Now that we have the new splits that we want, we run
    // the balancer to let it adjust the new phantom insulins to their theoretical
    // optimal value
    [insulins] = balance(
      insulins,
      windows,
      getInsulinVariant,
      getRescueVariant,
    );

    // Phase 3: Remove any negative/zerp doses (these are doses that have been overridden by a big previous dose)
    insulins = insulins.filter((insulin) => insulin.value > 0);

    return insulins;
  }
}

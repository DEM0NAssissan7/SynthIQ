import Insulin from "../../models/events/insulin";
import type { TreatmentWindow } from "../../models/types/treatmentWindow";
import { InsulinVariant } from "../../models/types/insulinVariant";
import { RescueVariant } from "../../models/types/rescueVariant";
import { useVariantGetters } from "./useVariantGetters";
import { PreferencesStore } from "../../storage/preferencesStore";
import Glucose from "../../models/events/glucose";
import { morphInsulins } from "./createWindow";
import { convertDimensions } from "../util";
import Unit from "../../models/unit";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";
import { PrivateStore } from "../../storage/privateStore";

export namespace InsulinOptimizer {
  // Helpers
  function insulinsDeepCopy(insulins: Insulin[]) {
    return insulins.map((i) => Insulin.deserialize(Insulin.serialize(i)));
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
  function propogateDoseDeltas(
    windows: TreatmentWindow[],
    deltaInsulins: Insulin[],
    doseIndex: number,
    getInsulinVariant: (variant: InsulinVariant) => InsulinVariant,
  ) {
    // Remorph to readjust all windows' partial insulin change distributions
    remorph(windows, deltaInsulins);
    // Now we go through all future windows and make theoretical partial adjustments to their
    // blood sugars specifically from our target dose
    for (let i = doseIndex; i < windows.length; i++) {
      const window = windows[i];
      const partialInsulin: Insulin = window.insulins[doseIndex];
      if (!partialInsulin || !partialInsulin.variant) continue;
      const deltaBG =
        -getInsulinVariant(partialInsulin.variant).effect *
        partialInsulin.value;
      window.finalBG += deltaBG;
      // Propogate total change forward (becuase lowering 10mg/dL now will make it theoretically 10mg/dL less in 10 hours or 100 days compared to an identical scenario)
      for (let j = i + 1; j < windows.length; j++) {
        const nextWindow = windows[j];
        nextWindow.initialBG += deltaBG;
        nextWindow.finalBG += deltaBG;
      }
    }
  }
  function getMaxAllowedDeltaUnits(
    windows: TreatmentWindow[],
    perpetratorIndex: number,
    perpetratorInsulin: Insulin,
    targetBG: number,
    getInsulinVariant: (variant: InsulinVariant) => InsulinVariant,
  ): number[] {
    const firstWindow = windows[perpetratorIndex];
    const maxTheoreticalDeltaBGs: number[] = [];
    for (let i = perpetratorIndex + 1; i < windows.length; i++) {
      // First, before anything, we need to make a meta-window to encapsulate the combination
      const thisWindow = windows[i];
      if (thisWindow.glucoses.length > 0 || firstWindow.glucoses.length > 0)
        throw new Error(
          `The assumption that glucoses have been cleared does not hold. This is a fatal error and the engine will not produce reliable results. This needs to be fixed - before passing vlues into getMaxAllowedDeltaUnits, first you must reverse the effects of glucose`,
        );

      // Now we get onto the business-end
      const wideDeltaBG = thisWindow.finalBG - targetBG;
      // Now we we find the total theoretical insulin effect from whatever is ahead of the perpetrator
      let totalAuxillaryInsulinEffect = 0;
      for (let j = perpetratorIndex + 1; j <= i; j++) {
        for (
          let k = perpetratorIndex + 1;
          k < windows[j].insulins.length;
          k++
        ) {
          const insulin = windows[j].insulins[k];
          if (!insulin || !insulin.variant) continue;
          totalAuxillaryInsulinEffect +=
            insulin.value * getInsulinVariant(insulin.variant).effect;
        }
      }

      const theoreticalMaxDeltaBG = wideDeltaBG + totalAuxillaryInsulinEffect;

      const perpetratorFraction = perpetratorInsulin.batemanIntegral(
        firstWindow.startTime,
        thisWindow.endTime,
        true,
      );
      // If the perpetrator does not affect us, let it do whatever it wants
      if (perpetratorFraction <= 0) {
        maxTheoreticalDeltaBGs.push(Infinity);
        continue;
      }

      // For example, if only 20% of the original dose is active during the super window, we can let the perpetrator have 2x more what it would be compared to if we had 40% of it active
      const maxAllowedDeltaUnits =
        theoreticalMaxDeltaBG /
        getInsulinVariant(perpetratorInsulin.variant).effect /
        perpetratorFraction;
      maxTheoreticalDeltaBGs.push(maxAllowedDeltaUnits);
    }
    return maxTheoreticalDeltaBGs;
  }
  function reverseGlucoseEffects(
    windows: TreatmentWindow[],
    getRescueVariant: (variant: RescueVariant) => RescueVariant,
  ) {
    // This function clears out the glucoses to basically extract from the windows "what would've happened if we didn't take glucose" because for the sake of safety, this obviously cannot be done IRL - we gotta do it in theory
    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      const glucoseEffect = window.glucoses.reduce(
        (n, glucose) =>
          n + glucose.value * getRescueVariant(glucose.variant).effect,
        0,
      );
      window.finalBG -= glucoseEffect;
      window.glucoses = [];
      // Propogate the change forward
      for (let j = i + 1; j < windows.length; j++) {
        const windowJ = windows[j];
        windowJ.initialBG -= glucoseEffect;
        windowJ.finalBG -= glucoseEffect;
      }
    }
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
    originalInsulins: Insulin[],
    windows: TreatmentWindow[],
    getInsulinVariant: (variant: InsulinVariant) => InsulinVariant,
    getRescueVariant: (variant: RescueVariant) => RescueVariant,
  ): [Insulin[], TreatmentWindow[]] {
    if (windows.length === 0 || originalInsulins.length === 0) return [[], []];

    // Set optimization target
    const targetBG = windows[0].initialBG; // Anchor to a target BG insteado of reducing per-window deltas
    const insulins = insulinsDeepCopy(originalInsulins);
    const deltaInsulins = insulinsDeepCopy(insulins);
    // Initialize all delta insulins to zero
    deltaInsulins.forEach((i) => (i.value = 0));
    // First, so we don't blame the meal for something glucose did, we inverse its effects from the windows completely
    reverseGlucoseEffects(windows, getRescueVariant);
    // Proceed through the windows procedurally
    for (let i = 0; i < Math.min(windows.length, insulins.length); i++) {
      const window = windows[i];
      const deltaInsulin = deltaInsulins[i];
      if (!deltaInsulin || !deltaInsulin.variant) continue;

      // This deltaBG is our needed adjustment budget for the window to pull down to target
      const deltaBG = window.finalBG - targetBG;
      // totalDeltaInsulin -> the total amount of insulin we need to absorb in THAT window
      // to get the optimal correction
      const totalDeltaInsulin =
        deltaBG / getInsulinVariant(deltaInsulin.variant).effect;
      // insulinEffectRatio -> the fraction of insulin from the window's shot that was absorbed in its timeframe
      const insulinEffectRatio = deltaInsulin.batemanIntegral(
        window.startTime,
        window.endTime,
        true,
      );
      const neededDelta = totalDeltaInsulin / insulinEffectRatio;
      // Now we look into the future windows/doses to see what they will allow us to do before pushing them over (into negative deltaBG)
      remorph(windows, insulins); // Remorph the windows to use the actual values of insulin (all previous insulins < i modifications do persist here)
      const maxAllowedDeltaUnits: number[] = getMaxAllowedDeltaUnits(
        windows,
        i,
        deltaInsulin,
        targetBG,
        getInsulinVariant,
      );
      // Apply it to our model
      const unconstrainedDelta = Math.min(neededDelta, ...maxAllowedDeltaUnits);
      deltaInsulin.value = Math.max(unconstrainedDelta, -insulins[i].value); // Prevent making own dose less than itself
      insulins[i].value += deltaInsulin.value; // Modify original dose
      // Now that the theoretical insulin deltas are applied, we
      // Propogate the simulated changes (deltas) forward
      propogateDoseDeltas(windows, deltaInsulins, i, getInsulinVariant);
    }
    // Before returning, morph the windows to match the final insulins (not deltas)
    remorph(windows, insulins);
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
    const [newInsulins, newWindows] = balance(
      insulins,
      windows,
      getInsulinVariant,
      getRescueVariant,
    );
    windows = newWindows;
    if (PrivateStore.debugLogs.value)
      if (newInsulins.filter((insulin) => insulin.value < 0).length > 0)
        console.warn(
          `[InsulinOptimizer]: Insulins contain a negative dose`,
          windows,
          insulins,
          _insulins,
        );
    /*if (PrivateStore.debugLogs.value)
      console.log(_insulins, insulins, inputWindows, windows);*/

    // Phase 3: Apply learning rate and prune any zero-doses
    const learningRate = PreferencesStore.learningRate.value / 100; // The stored learningRate is a percentage - convert to fraction
    const resultInsulins: Insulin[] = [];
    for (let i = 0; i < insulins.length; i++) {
      const original = insulins[i];
      const balanced = newInsulins[i];
      const delta = balanced.value - original.value;
      const damped = original.value + delta * learningRate;
      if (damped <= 0.01) continue; // Pruning
      resultInsulins.push(
        new Insulin(damped, balanced.timestamp, balanced.variant),
      );
    }

    return resultInsulins;
  }
}

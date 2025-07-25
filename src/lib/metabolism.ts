import type Session from "../models/session";
import Insulin from "../models/events/insulin";
import { profile } from "../storage/metaProfileStore";
import { getTimestampFromOffset } from "./timing";

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

function getPeakGlucose(
  f: (t: number) => number,
  until: number,
  interval: number,
  minThreshold: number,
  maxThreshold: number
): number | null {
  let funcMax = -Infinity;
  let y;
  for (let t = 0; t < until; t += interval) {
    // We sample 5 minute bits of the simulation over the course of 14 hours
    y = f(t);

    // Ignore if we go below minThreshold or above maxThreshold
    // This is an optimization to discard unwanted data
    if (y < minThreshold || y > maxThreshold) {
      return null;
    }

    // If we have a smaller maximum
    if (y > funcMax) {
      funcMax = y;
    }
  }
  return funcMax;
}

/** This function figures out the optimal meal timing by using the
 * metabolic profile values to simluate the curves.
 * Then, using the insulin curve, it will test timings (on a 1 minute interval)
 * until it achieves a curve above a minimum blood sugar (as set by the user)
 * and with the lowest maximum.
 */
const acceptableMax = 93;
const timeTestInterval = 5 / 60;
export function getOptimalInsulinTiming(
  session: Session,
  unitsInsulin: number,
  from: number,
  until: number
): Date {
  /** We test ALL points on the graph to see if we have a point that falls
   * below the low threshold while also keeping the maximum as low as possible */
  let minPeak = Infinity;
  let time: Date = new Date();
  const minThreshold = profile.minThreshold;
  const mealTimestamp = session.latestMealTimestamp;
  for (let n = from; n <= until; n += timeTestInterval) {
    // All insulin timings [within one minute] (from -> until)

    // Create a timestamp h hours away from the meal start (when you start eating)
    const testTime = getTimestampFromOffset(mealTimestamp, n);

    // Insulin
    session.testInsulins = [new Insulin(testTime, unitsInsulin)]; // We intentionally push directly to the insulins array to prevent notifying subscribers (and causing potential lag)

    const peak = getPeakGlucose(
      (t: number) => session.deltaBG(t),
      14,
      5 / 60,
      minThreshold,
      minPeak
    );
    if (peak === null) continue;
    if (peak < minPeak) {
      minPeak = peak;
      time = testTime;
      if (minPeak <= acceptableMax) break; // If something peaks at acceptableMax, we consider it optimal and just skip any further testing
    }
  }
  return time;
}

/* This algorithm directly bulids upon the first algorithm, but with some very notable changes

We test insulin dosing on a cascading basis. In other worse, we basically cherry pick the insulins
based on how well glycemic control is. We do it as follows.

Let's say, for some reason, the user wants 2 separate doses for their insulin.
Let's also assume the meal needs 5 units. We calculate as follows:

We start with the configuration 5 - 0 (first dose - second dose ) and calculate its
glycemic control (peak sugar)

Then, we move 4.75 - 0.25 and do the same. If it's a better configuration, we assign the insulins[] to
that configuration

Then, we go to 4.50 - 0.5 and do it again.

The key here is that we only reassign IF the configuration is better. Otherwise, we discard it and move on,
even if it has predicted glycemic control.

So perhaps the configuration of 2 - 3 might have the same control as 3 - 2, but we
ignore 2 - 3 and stick to 3 - 2 because the first dose is larger. It is a cascading algorithm that prefers
more insulin earlier on. We only switch if it's _better_

This only works for two injections. Optimizing for anything more is extremely expensive
and mostly pointless (except for insulin pumps, but this is not supported)
*/
export function getOptimalDualSplit(
  session: Session,
  unitsInsulin: number,
  from: number,
  until: number,
  stepSize: number = 0.5
): Insulin[] {
  let minPeak = Infinity;
  let optimalInsulins: Insulin[] = [
    new Insulin(session.latestMealTimestamp, unitsInsulin),
  ];

  const minThreshold = profile.minThreshold;
  const mealTimestamp = session.latestMealTimestamp;
  let dose1: number,
    dose2: number,
    n1: number,
    n2: number,
    time1: Date,
    time2: Date;
  // We do n2 first in the for loop chain because it's the lesser significant one
  // We also change the dosing first to try and get a solution quickly
  const testFirstShot = (): boolean => {
    // We then do n1 because it's a larger dose, and movements in its value cause larger changes in glucodynamics
    for (n1 = from; n1 <= until; n1 += timeTestInterval) {
      time1 = getTimestampFromOffset(mealTimestamp, n1);

      const insulins = [new Insulin(time1, dose1)];
      if (dose2 && time2) insulins.push(new Insulin(time2, dose2));

      session.testInsulins = insulins;

      const peak = getPeakGlucose(
        (t: number) => session.deltaBG(t),
        7,
        5 / 60,
        minThreshold,
        minPeak
      );
      if (peak === null) continue;
      if (peak < minPeak) {
        minPeak = peak;
        optimalInsulins = insulins;
        if (minPeak <= acceptableMax) return true; // If something peaks at acceptableMax, we consider it optimal and just skip any further testing to save time
      }
    }
    return false;
  };
  for (n2 = from; n2 <= until; n2 += timeTestInterval) {
    for (dose1 = unitsInsulin; dose1 > 0; dose1 -= stepSize) {
      dose2 = unitsInsulin - dose1;
      if (dose2) {
        // We only test n2 if we have a second dose at all
        time2 = getTimestampFromOffset(mealTimestamp, n2);
      }
      if (testFirstShot()) return optimalInsulins;
    }
  }

  return optimalInsulins;
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

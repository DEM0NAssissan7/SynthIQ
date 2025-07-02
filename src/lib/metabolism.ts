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
  return (glucose - profile.target) / profile.insulin.effect;
}

function getPeakGlucose(
  f: (t: number) => number,
  until: number,
  interval: number,
  minThreshold: number,
  maxThreshold: number
): number {
  let funcMax = -Infinity;
  let y;
  for (let t = 0; t < until; t += interval) {
    // We sample 5 minute bits of the simulation over the course of 14 hours
    y = f(t);

    // Ignore if we go below minThreshold or above maxThreshold
    // This is an optimization to discard unwanted data
    if (y < minThreshold || y > maxThreshold) {
      // console.log(testTime, y, t);
      return -1;
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
const acceptableMax = 95;
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
    if (peak < 0) continue;
    if (peak < minPeak) {
      minPeak = peak;
      time = testTime;
      if (minPeak <= acceptableMax) break; // If something peaks at acceptableMax, we consider it optimal and just skip any further testing
    }
  }
  return time;
}

// Glucose
export function getGlucoseCorrectionCaps(sugar: number) {
  return (profile.target - sugar) / profile.glucose.effect;
}

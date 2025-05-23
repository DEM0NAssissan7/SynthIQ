import Insulin from "../models/insulin";
import type Meal from "../models/meal";
import { profile } from "../storage/metaProfileStore";
import { getTimestampFromOffset } from "./timing";

export function getInsulin(carbs: number, protein: number) {
  return (
    (carbs * profile.carbs.effect + protein * profile.protein.effect) /
    profile.insulin.effect
  );
}
export function getCorrectionInsulin(glucose: number) {
  return (glucose - profile.target) / profile.insulin.effect;
}

/** This function figures out the optimal meal timing by using the
 * metabolic profile values to simluate the curves.
 * Then, using the insulin curve, it will test timings (on a 1 minute interval)
 * until it achieves a curve above a minimum blood sugar (as set by the user)
 * and with the lowest maximum.
 */
export function getOptimalInsulinTiming(
  meal: Meal,
  unitsInsulin: number,
  from: number,
  until: number
): Date {
  /** We test ALL points on the graph to see if we have a point that falls
   * below the low threshold while also keeping the maximum as low as possible */
  let maximum = Infinity;
  let time: Date = new Date();
  const threshold = profile.minThreshold;
  for (let n = from; n <= until; n += 1 / 60) {
    // All insulin timings [within one minute] (from -> until)

    // Create a timestamp h hours away from the meal start (when you start eating)
    const testTime = getTimestampFromOffset(meal.timestamp, n);

    // Insulin
    meal.testInsulins = []; // Get rid of all previous insulisn
    meal.testInsulins = [new Insulin(testTime, unitsInsulin)]; // We intentionally push directly to the insulins array to prevent notifying subscribers (and causing potential lag)

    let funcMax = -Infinity;
    (() => {
      for (let t = 0; t < 14; t += 5 / 60) {
        // We sample 5 minute bits of the simulation over the course of 14 hours
        let y = meal.deltaBG(t);

        // Ignore if we go below threshold
        if (y < threshold) {
          // console.log(testTime, y, t);
          return;
        }

        // If we have a smaller maximum
        if (y > funcMax) {
          funcMax = y;
        }
      }
      if (funcMax < maximum) {
        maximum = funcMax;
        time = testTime;
      }
    })();
  }
  return time;
}

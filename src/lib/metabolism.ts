import Insulin from "../models/insulin";
import type Meal from "../models/meal";
import MetaFunctions, { metaKernel } from "../models/metaFunctions";
import metaProfile from "../storage/metaProfileStore";
import { getTimestampFromOffset } from "./util";

export function getInsulin(carbs: number, protein: number) {
  return (
    (carbs * metaProfile.get("ecarbs") +
      protein * metaProfile.get("eprotein")) /
    metaProfile.get("einsulin")
  );
}
export function getCorrectionInsulin(glucose: number) {
  return (glucose - metaProfile.get("target")) / metaProfile.get("einsulin");
}

// Metabolism Simulations
export const defaultGI = 20;

export class MetabolismFunction {
  /** Carbohydrates tend to follow a parabolic curve that peaks and falls off
   * This function attempts to mimic that behavior
   */
  static carbs(t: number, carbs: number, GI: number): number {
    return metaKernel(
      t,
      carbs * metaProfile.get("ecarbs"),
      metaProfile.get("ncarbs"),
      metaProfile.get("pcarbs") * (defaultGI / GI),
      MetaFunctions.G
    );
  }
  /** Protein seems to have a continuous, steady release
   * that gets longer the more protein injected.
   * Protein's blood sugar increase rate doesn't seem to increase at all,
   * only the duration it happens for. That's why we extend the duration on this too.
   */
  static protein(t: number, protein: number) {
    return metaKernel(
      t,
      protein * metaProfile.get("eprotein"),
      metaProfile.get("nprotein"),
      metaProfile.get("cprotein") /* The minimum time protein can take */ +
        protein * metaProfile.get("pprotein"), // Plateu (hour / gram)
      MetaFunctions.C
    );
  }
  /** Insulin is best modeled by a half life decaying function */
  static insulin(t: number, units: number) {
    return metaKernel(
      t,
      -units * metaProfile.get("einsulin"),
      metaProfile.get("ninsulin"),
      metaProfile.get("pinsulin"),
      MetaFunctions.H // Half life decay
    );
  }
  /** Glucose is released very quickly in the blood and quickly tapers off.
   * This has not yet been tested.
   */
  static glucose(t: number, grams: number) {
    return metaKernel(
      t,
      grams * metaProfile.get("ecarbs"),
      metaProfile.get("nglucose"),
      metaProfile.get("pglucose"),
      MetaFunctions.G
    );
  }
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
  const previousInsulins = meal.insulins;
  const threshold = metaProfile.get("minThreshold");
  // console.log(
  //   -unitsInsulin * metaProfile.get("einsulin") +
  //     meal.getCarbs() * metaProfile.get("ecarbs") +
  //     meal.getProtein() * metaProfile.get("eprotein")
  // );
  for (let n = from; n <= until; n += 1 / 60) {
    // All insulin timings [within one minute] (from -> until)

    // Create a timestamp h hours away from the meal start (when you start eating)
    const testTime = getTimestampFromOffset(meal.timestamp, n);

    // Insulin
    meal.insulins = []; // Get rid of all previous insulisn
    // We intentionally push directly to the insulins array to prevent notifying subscribers (and causing potential lag)
    meal.insulins.push(new Insulin(testTime, unitsInsulin));

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
  meal.insulins = previousInsulins;
  return time;
}

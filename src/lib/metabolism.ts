import Insulin from "../models/insulin";
import type Meal from "../models/meal";
import StorageNode from "./storageNode";
import { getTimestampFromOffset } from "./util";

export const metaProfile = new StorageNode("profile");

// General User Prefs
metaProfile.add("target", 83);
metaProfile.add("minThreshold", 75);

// Glucose Shot Characteristics
metaProfile.add("pglucose", 6.45);
metaProfile.add("nglucose", 0);
metaProfile.add("mlsPerCap", 5);
metaProfile.add("gramsPerMl", 1 / 3);

// Inuslin Pharmacodynamics
metaProfile.add("einsulin", 28); // Insulin point effect / unit
metaProfile.add("pinsulin", 3); // insulin half-life in blood
metaProfile.add("ninsulin", 0.5); // hrs delay before insulin starts working

// Carbohydrate Metabolism
metaProfile.add("ecarbs", 4.11); // Rise per gram of carbs
metaProfile.add("ncarbs", 0.0);
metaProfile.add("pcarbs", 1.61);

// Protein Gluconeogenesis Metabolism
metaProfile.add("eprotein", 1.19); // Rise per gram of protein
metaProfile.add("nprotein", 0.0);
// Metabolism Characteristics
metaProfile.add("cprotein", 3.6); // Rise time
metaProfile.add("pprotein", 0.0351); // Plateau Time Rate (hours / gram)
metaProfile.add("fprotein", 1.83); // Fall time

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
  console.log(
    -unitsInsulin * metaProfile.get("einsulin") +
      meal.getCarbs() * metaProfile.get("ecarbs") +
      meal.getProtein() * metaProfile.get("eprotein")
  );
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

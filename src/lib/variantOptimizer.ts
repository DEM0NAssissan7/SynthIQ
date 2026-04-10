import type Meal from "../models/events/meal";
import type MealTemplate from "../models/mealTemplate";
import type Session from "../models/session";
import { InsulinVariant } from "../models/types/insulinVariant";
import { RescueVariant } from "../models/types/rescueVariant";
import { MathUtil } from "./util";

export function splitIdenticalMeals(sessions: Session[]): Session[][] {
  // These two have synchronized indexes
  let recordedMeals: Meal[] = [];
  let splitSessions: Session[][] = [];

  for (let session of sessions) {
    if (session.meals.length !== 1)
      throw new Error(
        `Cannot split identical meals if a session has anything besides one meal`,
      );
    const meal = session.firstMeal;
    // Check if it has an identical meal set
    let hasIdentical = false;
    for (let i = 0; i < recordedMeals.length; i++) {
      const m = recordedMeals[i];
      if (meal.isIdentical(m)) {
        hasIdentical = true;
        splitSessions[i].push(session);
        break;
      }
    }
    if (hasIdentical) continue;

    // If not, we add a new meal set
    recordedMeals.push(meal);
    splitSessions.push([session]);
  }

  return splitSessions;
}
export function getAvgOptimalStdev(
  groupedSplitSessions: Session[][][],
  insulinVariants: InsulinVariant[],
  rescueVariants: RescueVariant[],
) {
  let stdevs: number[] = [];
  let weights: number[] = [];

  // insulin and rescue variants getters (optimized)
  const insulinVariantMap = new Map<string, InsulinVariant>();
  const rescueVariantMap = new Map<string, RescueVariant>();
  insulinVariants.forEach((v) => insulinVariantMap.set(v.name, v));
  rescueVariants.forEach((v) => rescueVariantMap.set(v.name, v));

  function getInsulinVariant(name: string): InsulinVariant {
    const variant = insulinVariantMap.get(name);
    if (!variant) throw new Error(`Insulin variant ${name} does not exist`);
    return variant;
  }
  function getRescueVariant(name: string): RescueVariant {
    const variant = rescueVariantMap.get(name);
    if (!variant) throw new Error(`Glucose variant ${name} does not exist`);
    return variant;
  }

  // Go through all sessions that exist
  for (let splitSessions of groupedSplitSessions) {
    for (let sessions of splitSessions) {
      // We are now looking at a set of sessions that have _identical_ meals
      if (sessions.length < 2) continue;
      const optimalMealInsulins = sessions.map((s) => {
        // Calculate the theoretical optimal insulin
        let insulin = 0;
        const windows = s.windows;
        for (let window of windows) {
          const insulinVariant = getInsulinVariant(window.insulin.variant.name);
          const deltaBG = window.finalBG - window.initialBG;
          insulin += deltaBG / insulinVariant.effect;

          // Calculate glucose effect
          let glucoseEffect = 0;
          for (let glucose of window.glucoses) {
            const rescueVariant = getRescueVariant(glucose.variant.name);
            glucoseEffect += glucose.value * rescueVariant.effect;
          }
          insulin -= glucoseEffect / insulinVariant.effect;
          insulin += window.insulin.value;
        }
        return insulin;
      });
      stdevs.push(MathUtil.stdev(optimalMealInsulins));
      weights.push(optimalMealInsulins.length);
    }
  }
  let weightedSum = 0;
  let totalWeights = 0;
  for (let i = 0; i < stdevs.length; i++) {
    const weight = weights[i];
    weightedSum += weight * stdevs[i];
    totalWeights += weight;
  }
  return weightedSum / totalWeights;
}
export function optimizeVariants(
  templates: MealTemplate[],
  _insulinVariants: InsulinVariant[],
  _rescueVariants: RescueVariant[],
  targetNames: string[],
): { insulinVariants: InsulinVariant[]; rescueVariants: RescueVariant[] } {
  let insulinVariants = _insulinVariants.map((v) =>
    InsulinVariant.deserialize(InsulinVariant.serialize(v)),
  );
  let rescueVariants = _rescueVariants.map((v) =>
    RescueVariant.deserialize(RescueVariant.serialize(v)),
  );

  let groupedSplitSessions: Session[][][] = [];
  for (let template of templates) {
    const splitSessions = splitIdenticalMeals(template.validSessions);
    groupedSplitSessions.push(splitSessions);
  }
  let smallestStdev = getAvgOptimalStdev(
    groupedSplitSessions,
    insulinVariants,
    rescueVariants,
  ); // Get a baseline

  function isBest() {
    const stdev = getAvgOptimalStdev(
      groupedSplitSessions,
      insulinVariants,
      rescueVariants,
    );
    if (stdev < smallestStdev) {
      smallestStdev = stdev;
      return true;
    }
    return false;
  }

  type affectableVariant = { name: string; effect: number };
  const allVariants: affectableVariant[] = [
    ...insulinVariants,
    ...rescueVariants,
  ];

  // Greedy coordinate descent
  let iterations = 0;
  const maxIterations = 100; // Nothing usually deviates more than 100mg/dL per unit
  while (iterations++ < maxIterations) {
    let improved = false;
    for (let va of allVariants) {
      const name = va.name;
      let hasMatch = false;
      targetNames.forEach((n) => {
        if (n === name) hasMatch = true;
      });
      if (!hasMatch && targetNames.length !== 0) continue;

      const origin = va.effect; // The original value we started with
      let improvement = 0; // What offset from origin do we get the best result with

      va.effect = origin + 1;
      if (isBest()) improvement = 1;

      // Sanity check
      if (origin - 1 > 0) {
        va.effect = origin - 1; // Back to origin, -1 to test
        if (isBest()) improvement = -1;
      }

      // Commit the best change
      va.effect = origin + improvement;

      // Record if we improved globally
      if (improvement !== 0) improved = true;
    }

    // After the stepping iterations are complete, we look at if we have made any improvements at all. If nothing improved, call it a day.
    if (!improved) break;
  }

  return {
    insulinVariants,
    rescueVariants,
  };
}

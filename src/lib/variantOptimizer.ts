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
export function getAvgMealRiseStdev(
  groupedSplitSessions: Session[][][],
  insulinVariants: InsulinVariant[],
  rescueVariants: RescueVariant[],
) {
  let stdevs: number[] = [];
  let weights: number[] = [];

  // Go through all sessions that exist
  for (let splitSessions of groupedSplitSessions) {
    for (let sessions of splitSessions) {
      // We are now looking at a set of sessions that have _identical_ meals
      if (sessions.length < 2) continue;
      const theoreticalMealRises: number[] = sessions.map((s) =>
        s.getTheoreticalMealRise(insulinVariants, rescueVariants),
      );
      const stdev = MathUtil.stdev(theoreticalMealRises);
      const mean = MathUtil.mean(theoreticalMealRises);
      const normalizedStdev = stdev / Math.max(Math.abs(mean), 1e-6);
      stdevs.push(normalizedStdev);
      weights.push(theoreticalMealRises.length);
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
type AffectableVariant = { name: string; effect: number };
function getEffectPenalty(
  effects: number[],
  originalEffects: number[],
): number {
  let penalties: number[] = [];

  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    const originalEffect = originalEffects[i];
    penalties.push(((effect - originalEffect) / originalEffect) ** 2);
  }

  return MathUtil.mean(penalties);
}
export function optimizeVariants(
  templates: MealTemplate[],
  _insulinVariants: InsulinVariant[],
  _rescueVariants: RescueVariant[],
  targetNames: string[],
): { insulinVariants: InsulinVariant[]; rescueVariants: RescueVariant[] } {
  const insulinVariants = _insulinVariants.map((v) =>
    InsulinVariant.deserialize(InsulinVariant.serialize(v)),
  );
  const rescueVariants = _rescueVariants.map((v) =>
    RescueVariant.deserialize(RescueVariant.serialize(v)),
  );

  const groupedSplitSessions: Session[][][] = [];
  for (const template of templates) {
    groupedSplitSessions.push(splitIdenticalMeals(template.validSessions));
  }

  const allVariants: AffectableVariant[] = [
    ...insulinVariants,
    ...rescueVariants,
  ];

  const filteredVariants =
    targetNames.length === 0
      ? allVariants
      : allVariants.filter((v) => targetNames.includes(v.name));
  const originalEffects = filteredVariants.map((a) => a.effect);

  function getScore() {
    const lambda = 1.2;
    return (
      getAvgMealRiseStdev(
        groupedSplitSessions,
        insulinVariants,
        rescueVariants,
      ) +
      getEffectPenalty(
        filteredVariants.map((a) => a.effect),
        originalEffects,
      ) *
        lambda
    );
  }

  let iterations = 0;
  const maxIterations = 100;

  while (iterations++ < maxIterations) {
    let improved = false;

    for (const va of filteredVariants) {
      const origin = va.effect;
      const currentScore = getScore();

      let bestEffect = origin;
      let bestScore = currentScore;

      va.effect = origin + 1;
      const plusScore = getScore();
      if (plusScore < bestScore) {
        bestScore = plusScore;
        bestEffect = origin + 1;
      }

      va.effect = origin - 1;
      const minusScore = getScore();
      if (minusScore < bestScore) {
        bestScore = minusScore;
        bestEffect = origin - 1;
      }

      va.effect = bestEffect;

      if (bestEffect !== origin) {
        improved = true;
      }
    }

    if (!improved) break;
  }

  return {
    insulinVariants,
    rescueVariants,
  };
}

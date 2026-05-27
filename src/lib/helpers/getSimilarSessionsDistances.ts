import type Food from "../../models/food";
import { MathUtil } from "../util";
import type Meal from "../../models/events/meal";
import type Session from "../../models/session";

export type SessionAndScore = [Session, number];

export function getSimilarSessionsDistances(meal: Meal, sessions: Session[]) {
  function toFoodMap(foods: Food[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const food of foods) {
      map.set(food.name, (map.get(food.name) ?? 0) + food.amount);
    }
    return map;
  }

  const targetMap = toFoodMap(meal.summedFoods);
  const sessionMaps = sessions.map((s) => toFoodMap(s.firstMeal.summedFoods));

  const allFoodNames = new Set<string>();
  for (const map of sessionMaps) {
    for (const name of map.keys()) allFoodNames.add(name);
  }
  for (const name of targetMap.keys()) allFoodNames.add(name);

  const foodScales = new Map<string, number>();
  for (const name of allFoodNames) {
    const amounts = sessionMaps.map((map) => map.get(name) ?? 0);
    const mad = MathUtil.meanAbsoluteDeviation(amounts);
    foodScales.set(name, Math.max(mad, 2e-3));
  }

  const sessionsDistances: SessionAndScore[] = sessions.map((session, i) => {
    const sessionMap = sessionMaps[i];
    let dist = 0;

    for (const name of allFoodNames) {
      const a = sessionMap.get(name) ?? 0;
      const b = targetMap.get(name) ?? 0;
      const scale = foodScales.get(name) ?? 1;
      dist += ((a - b) / scale) ** 2;
    }

    return [session, dist];
  });

  sessionsDistances.sort((a, b) => a[1] - b[1]); // Sort from smallest distance to largest
  return sessionsDistances;
}

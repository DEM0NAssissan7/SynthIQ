import { useState, useEffect } from "react";
import type Meal from "../models/meal";
import type Food from "../models/food";

export default function useMealState(meal: Meal) {
  const [, setVersion] = useState(0);

  const rerender = () => setVersion((v) => v + 1); // force re-render
  useEffect(() => {
    meal.subscribe(rerender);
    return () => meal.unsubscribe(rerender);
  }, []);

  return {
    meal,
    carbs: meal.carbs,
    protein: meal.protein,

    insulin: meal.insulin,
    insulinTimestamp: (() => {
      if (meal.insulins.length !== 0) return meal.insulins[0].timestamp;
      else return new Date();
    })(),
    setInsulin: (units: number) => {
      meal.insulins = [];
      meal.createInsulin(new Date(), units);
    },

    initialGlucose: meal._initialGlucose,
    setInitialGlucose: (g: number) => (meal.initialGlucose = g),

    addedFoods: meal.addedFoods,

    extraCarbs: meal.carbsOffset,
    setExtraCarbs: (g: number) => (meal.carbsOffset = g),

    extraProtein: meal.proteinOffset,
    setExtraProtein: (g: number) => (meal.proteinOffset = g),

    addFood: (food: Food) => meal.addFood(food),
    removeFood: (food: Food) => meal.removeFood(food),
    hasFood: (food: Food) => meal.hasFood(food),
    changeFoodAmount: (food: Food, amount: number) =>
      meal.setFoodAmount(food, amount),
  };
}

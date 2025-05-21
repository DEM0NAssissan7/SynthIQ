import { useState, useEffect, useMemo } from "react";
import type Meal from "../models/meal";
import { wizardStorage } from "../storage/wizardStore";
import type Food from "../models/food";

export default function useWizardMeal(): Meal {
  const meal: Meal = wizardStorage.get("meal");
  const [, setVersion] = useState(0);

  useEffect(() => {
    const rerender = () => setVersion((v) => v + 1); // force re-render
    meal.subscribe(rerender);
    return () => meal.unsubscribe(rerender);
  }, []);

  return meal;
}

export function useWizardMealState() {
  const meal = useWizardMeal();

  return {
    meal,
    carbs: meal.getCarbs(),
    protein: meal.getProtein(),

    insulin: meal.getInsulin(),
    insulinTimestamp: () => {
      if (meal.insulins.length !== 0) return meal.insulins[0].timestamp;
      else return new Date();
    },
    setInsulin: (units: number) => {
      meal.insulins = [];
      meal.insulin(new Date(), units);
    },

    initialGlucose: meal.initialGlucose,
    setInitialGlucose: (g: number) => meal.setInitialGlucose(g),

    addedFoods: meal.foods.slice(2), // skip offsets

    extraCarbs: meal.getCarbsOffset(),
    setExtraCarbs: (g: number) => meal.setCarbsOffset(g),

    extraProtein: meal.getProteinOffset(),
    setExtraProtein: (g: number) => meal.setProteinOffset(g),

    addFood: (food: Food) => meal.addFood(food),
    removeFood: (food: Food) => meal.removeFood(food),
    hasFood: (food: Food) => meal.hasFood(food),
    getFoodAmount: (food: Food) => meal.getFoodAmount(food),
    changeFoodAmount: (food: Food, amount: number) =>
      meal.setFoodAmount(food, amount),
  };
}

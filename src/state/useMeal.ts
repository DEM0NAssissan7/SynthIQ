import { useEffect, useState } from "react";
import type Meal from "../models/meal";
import { wizardStorage } from "../storage/wizardStore";

export default function useMeal(meal: Meal) {
  const [, setVersion] = useState(0);

  const rerender = () => setVersion((v) => v + 1); // force re-render
  useEffect(() => {
    meal.subscribe(rerender);
    return () => meal.unsubscribe(rerender);
  }, []);

  return meal;
}

export function useWizardMeal() {
  return useMeal(wizardStorage.get("meal"));
}

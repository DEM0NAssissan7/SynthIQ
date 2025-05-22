import { useState, useEffect } from "react";
import NightscoutManager from "../lib/nightscoutManager";
import type Meal from "../models/meal";

export default function useImportedMealsState() {
  const [importedMeals, setImportedMeals] = useState<Meal[]>([]);

  const [version, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1); // force re-render

  useEffect(() => {
    NightscoutManager.getAllMeals().then((m) => {
      console.log(m);
      setImportedMeals(m);
    });
  }, [version]);

  const ignoreMeal = (meal: Meal) => {
    NightscoutManager.ignoreUUID(meal.uuid);
    rerender(); // Trigger a re-render to pull new data from nightscout. This is also some kind of dogfooding.
  };
  function clearIgnoredMeals() {
    NightscoutManager.clearIgnoredUUIDs();
    rerender(); // Trigger a re-render to pull new data from nightscout. This is also some kind of dogfooding.
  }

  return {
    ignoreMeal,
    importedMeals,
    clearIgnoredMeals,
  };
}

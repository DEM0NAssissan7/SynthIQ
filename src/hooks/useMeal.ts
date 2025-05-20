import { useEffect, useState } from "react";
import type Meal from "../models/meal";

// Hook for React to "subscribe" to meal changes
export default function useMeal(meal: Meal): Meal {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const update = () => forceUpdate((x) => x + 1); // Re-render on notify
    meal.subscribe(update);
    return () => meal.unsubscribe(update);
  }, [meal]);

  return meal;
}

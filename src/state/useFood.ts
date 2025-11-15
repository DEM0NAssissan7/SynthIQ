import { useState } from "react";
import type Food from "../models/food";
import type Meal from "../models/events/meal";

export default function useFood(food: Food, meal?: Meal) {
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  return {
    amount: food.amount,
    carbs: food.carbs,
    protein: food.protein,
    fiber: food.fiber,
    rise: food.rise,
    setAmount: (amount: number) => {
      food.amount = amount;
      meal?.notify();
      rerender();
    },
  };
}

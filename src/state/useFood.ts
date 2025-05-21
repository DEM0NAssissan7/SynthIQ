import { useEffect, useState } from "react";
import type Food from "../models/food";
import type Meal from "../models/meal";

export default function useFood(food: Food) {
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  return {
    amount: food.amount,
    carbs: food.getCarbs(),
    protein: food.getProtein(),
    setAmount: (amount: number) => {
      food.amount = amount;
      rerender();
    },
  };
}

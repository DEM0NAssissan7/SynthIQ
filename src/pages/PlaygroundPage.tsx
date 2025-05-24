import { useEffect } from "react";
import AddedFoodsDisplay from "../components/AddedFoodsDisplay";
import FoodSearchDisplay from "../components/FoodSearchDisplay";
import Meal from "../models/meal";
import useMeal from "../state/useMeal";

export default function PlaygroundPage() {
  const meal = useMeal(new Meal(new Date()));

  useEffect(() => {
    console.log(meal.foods);
  }, [meal]);
  return (
    <>
      <h1>Playground</h1>
      <p>
        This is purely for educational purposes. NEVER rely on this app for
        medical decisions.
      </p>
      <FoodSearchDisplay meal={meal} />

      <AddedFoodsDisplay meal={meal} />
    </>
  );
}

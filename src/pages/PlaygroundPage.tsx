import { useEffect } from "react";
import AddedFoodsDisplay from "../components/AddedFoodsDisplay";
import FoodSearchDisplay from "../components/FoodSearchDisplay";
import Meal from "../models/meal";
import useMeal from "../state/useMeal";
import InsulinManager from "../components/InsulinManager";
import MealGraph from "../components/MealGraph";

let playgroundMeal = new Meal(new Date());
export default function PlaygroundPage() {
  useEffect(() => {
    playgroundMeal = new Meal(new Date());
  }, []);
  const meal = useMeal(playgroundMeal);

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

      <InsulinManager meal={meal} />

      <MealGraph meal={meal} from={-1} until={14} />
    </>
  );
}

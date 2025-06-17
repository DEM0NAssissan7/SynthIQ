import { useEffect } from "react";
import AddedFoodsDisplay from "../components/AddedFoodsDisplay";
import FoodSearchDisplay from "../components/FoodSearchDisplay";
import Meal from "../models/meal";
import useMeal from "../state/useMeal";
import InsulinManager from "../components/InsulinManager";
import EventGraph from "../components/EventGraph";
import useEvent from "../state/useEvent";
import MetaEvent from "../models/event";

let playgroundMeal = new Meal(new Date());
let playgroundEvent = new MetaEvent(false);
export default function PlaygroundPage() {
  const meal = useMeal(playgroundMeal);
  const event = useEvent(playgroundEvent);

  useEffect(() => {
    const handler = () => event.notify();
    meal.subscribe(handler);
    return () => {
      meal.unsubscribe(handler);
    };
  }, []);

  // We add the meal to the testmeals upon change
  useEffect(() => {
    event.clearTestMeals();
    event.addTestMeal(meal);
    console.log(meal.carbs, event);
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

      <InsulinManager event={event} />

      <EventGraph event={event} from={-1} until={14} />
    </>
  );
}

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
  useEffect(() => {
    playgroundMeal = new Meal(new Date());
    playgroundEvent = new MetaEvent(false);
  }, []);
  const meal = useMeal(playgroundMeal);
  const event = useEvent(playgroundEvent);

  useEffect(() => {
    console.log(meal.foods);
  }, [meal]);
  useEffect(() => {
    console.log(event);
  }, [event]);
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

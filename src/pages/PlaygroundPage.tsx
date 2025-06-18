import { useEffect } from "react";
import AddedFoodsDisplay from "../components/AddedFoodsDisplay";
import FoodSearchDisplay from "../components/FoodSearchDisplay";
import Meal from "../models/meal";
import useMeal from "../state/useMeal";
import InsulinManager from "../components/InsulinManager";
import EventGraph from "../components/EventGraph";
import useEvent from "../state/useEvent";
import MetaEvent from "../models/event";
import GlucoseManager from "../components/GlucoseManager";
import Card from "../components/Card";
import { Form } from "react-bootstrap";
import MealAdditionalNutrientsCard from "../components/MealAdditionalNutrientsCard";

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

  // We add the meal to the event
  useEffect(() => {
    event.addMeal(meal);
    console.log(meal, event);
  }, []);
  return (
    <>
      <h1>Playground</h1>
      <p>
        This is purely for educational purposes. NEVER rely on this app for
        medical decisions.
      </p>
      <Card>
        <FoodSearchDisplay meal={meal} />
      </Card>

      <Card>
        <AddedFoodsDisplay meal={meal} />
      </Card>

      <MealAdditionalNutrientsCard meal={meal} />

      <Card>
        <InsulinManager event={event} />
      </Card>

      <Card>
        <GlucoseManager event={event} />
      </Card>

      <Card>
        <Form.Label>Graph</Form.Label>
        <EventGraph event={event} from={-1} until={12} />
      </Card>
    </>
  );
}

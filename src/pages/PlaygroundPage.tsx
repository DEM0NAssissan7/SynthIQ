import { useEffect } from "react";
import AddedFoodsDisplay from "../components/AddedFoodsDisplay";
import FoodSearchDisplay from "../components/FoodSearchDisplay";
import Meal from "../models/events/meal";
import useMeal from "../state/useMeal";
import InsulinManager from "../components/InsulinManager";
import SessionGraph from "../components/SessionGraph";
import useSession from "../state/useSession";
import Session from "../models/session";
import GlucoseManager from "../components/GlucoseManager";
import Card from "../components/Card";
import { Form } from "react-bootstrap";
import MealAdditionalNutrients from "../components/MealAdditionalNutrientsCard";
import SessionSummary from "../components/SessionSummary";

let playgroundMeal = new Meal(new Date());
let playgroundSession = new Session(false);
playgroundSession.addMeal(playgroundMeal);
export default function PlaygroundPage() {
  const meal = useMeal(playgroundMeal);
  const session = useSession(playgroundSession);

  useEffect(() => {
    console.log(playgroundMeal, playgroundSession);
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

      <Card>
        <MealAdditionalNutrients meal={meal} />
      </Card>

      <Card>
        <InsulinManager session={session} />
      </Card>

      <Card>
        <GlucoseManager session={session} />
      </Card>

      <Card>
        <SessionSummary session={session} />
      </Card>

      <Card>
        <Form.Label>Graph</Form.Label>
        <SessionGraph session={session} from={-1} until={12} />
      </Card>
    </>
  );
}

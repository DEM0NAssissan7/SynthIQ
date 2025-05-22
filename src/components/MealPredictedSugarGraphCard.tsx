import { Form } from "react-bootstrap";
import MealGraph from "./MealGraph";
import type Meal from "../models/meal";

interface MealPredictedSugarGraphCardProps {
  meal: Meal;
}
export default function MealPredictedSugarGraphCard({
  meal,
}: MealPredictedSugarGraphCardProps) {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <Form.Label>Predicted Blood Sugar</Form.Label>
        <MealGraph meal={meal} from={-1} until={16} width="100%"></MealGraph>
      </div>
    </div>
  );
}

import { Form } from "react-bootstrap";
import MealGraph from "./MealGraph";
import { useWizardMeal } from "../state/useMeal";

export default function MealPredictedSugarGraphCard() {
  const meal = useWizardMeal();

  return (
    <div className="card mb-4">
      <div className="card-body">
        <Form.Label>Predicted Blood Sugar</Form.Label>
        <MealGraph meal={meal} from={-1} until={16} width="100%"></MealGraph>
      </div>
    </div>
  );
}

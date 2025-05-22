import { Form, ListGroup } from "react-bootstrap";
import NutritionOffset from "./NutritionOffset";
import { useWizardMeal } from "../state/useMeal";

export default function MealAdditionalNutrientsCard() {
  const meal = useWizardMeal();
  return (
    <div className="card mb-4">
      <div className="card-body">
        <Form.Label>Additional Nutrition</Form.Label>
        <ListGroup>
          <ListGroup.Item>
            <NutritionOffset
              label="Carbs"
              value={meal.carbsOffset}
              setValue={(a: number) => (meal.carbsOffset = a)}
              iconClassName="bi bi-cookie"
            />
            <NutritionOffset
              label="Protein"
              value={meal.proteinOffset}
              setValue={(a: number) => (meal.proteinOffset = a)}
              iconClassName="bi bi-egg-fried"
            />
          </ListGroup.Item>
        </ListGroup>
      </div>
    </div>
  );
}

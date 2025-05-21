import { Form, ListGroup } from "react-bootstrap";
import NutritionOffset from "./NutritionOffset";
import { useWizardMealState } from "../state/useWizardMeal";

export default function MealAdditionalNutrientsCard() {
  const { extraCarbs, setExtraCarbs, extraProtein, setExtraProtein } =
    useWizardMealState();
  return (
    <div className="card mb-4">
      <div className="card-body">
        <Form.Label>Additional Nutrition</Form.Label>
        <ListGroup>
          <ListGroup.Item>
            <NutritionOffset
              label="Carbs"
              value={extraCarbs}
              setValue={setExtraCarbs}
              iconClassName="bi bi-cookie"
            />
            <NutritionOffset
              label="Protein"
              value={extraProtein}
              setValue={setExtraProtein}
              iconClassName="bi bi-egg-fried"
            />
          </ListGroup.Item>
        </ListGroup>
      </div>
    </div>
  );
}

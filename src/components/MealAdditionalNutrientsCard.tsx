import { Form, ListGroup } from "react-bootstrap";
import NutritionOffset from "./NutritionOffset";
import type Meal from "../models/meal";
import Card from "./Card";

interface MealAdditionalNutrientsCardProps {
  meal: Meal;
}
export default function MealAdditionalNutrientsCard({
  meal,
}: MealAdditionalNutrientsCardProps) {
  return (
    <Card>
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
    </Card>
  );
}

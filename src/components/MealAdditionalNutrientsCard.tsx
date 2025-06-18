import { ListGroup } from "react-bootstrap";
import NutritionOffset from "./NutritionOffset";
import type Meal from "../models/meal";

interface MealAdditionalNutrientsProps {
  meal: Meal;
}
export default function MealAdditionalNutrients({
  meal,
}: MealAdditionalNutrientsProps) {
  return (
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
  );
}

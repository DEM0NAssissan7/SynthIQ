import type Meal from "../models/meal";
import Card from "./Card";
import FoodSearchDisplay from "./FoodSearchDisplay";

interface MealSearchCardProps {
  meal: Meal;
}
export default function MealSearchCard({ meal }: MealSearchCardProps) {
  return (
    <Card>
      <FoodSearchDisplay meal={meal} />
    </Card>
  );
}

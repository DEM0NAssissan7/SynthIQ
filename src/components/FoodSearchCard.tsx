import type Meal from "../models/meal";
import Card from "./Card";
import FoodSearchDisplay from "./FoodSearchDisplay";

interface FoodSearchCardProps {
  meal: Meal;
}
export default function FoodSearchCard({ meal }: FoodSearchCardProps) {
  return (
    <Card>
      <FoodSearchDisplay meal={meal} />
    </Card>
  );
}

import type Meal from "../models/meal";
import AddedFoodsDisplay from "./AddedFoodsDisplay";
import Card from "./Card";

interface MealAddedFoodsListCardProps {
  meal: Meal;
}
export default function MealAddedFoodsListCard({
  meal,
}: MealAddedFoodsListCardProps) {
  return (
    <Card>
      <AddedFoodsDisplay meal={meal} />
    </Card>
  );
}

import type Meal from "../models/meal";
import AddedFoodsDisplay from "./AddedFoodsDisplay";

interface MealAddedFoodsListCardProps {
  meal: Meal;
}
export default function MealAddedFoodsListCard({
  meal,
}: MealAddedFoodsListCardProps) {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <AddedFoodsDisplay meal={meal} />
      </div>
    </div>
  );
}

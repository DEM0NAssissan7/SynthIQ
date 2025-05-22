import type Meal from "../models/meal";
import FoodSearchDisplay from "./FoodSearchDisplay";

interface MealSearchCardProps {
  meal: Meal;
}
export default function MealSearchCard({ meal }: MealSearchCardProps) {
  return (
    <>
      <div className="card mb-4">
        <div className="card-body">
          <FoodSearchDisplay meal={meal} />
        </div>
      </div>
    </>
  );
}

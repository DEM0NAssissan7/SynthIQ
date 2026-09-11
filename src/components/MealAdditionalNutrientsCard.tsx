import NutritionOffset from "./NutritionOffset";
import type Meal from "../models/events/meal";

interface MealAdditionalNutrientsProps {
  meal: Meal;
}
export default function MealAdditionalNutrients({
  meal,
}: MealAdditionalNutrientsProps) {
  return (
    <div className="row g-2">
      <div className="col-6">
        <NutritionOffset
          label="Extra Carbs"
          value={meal.carbsOffset}
          setValue={(a: number) => (meal.carbsOffset = a)}
          iconClassName="bakery_dining"
        />
      </div>
      <div className="col-6">
        <NutritionOffset
          label="Extra Protein"
          value={meal.proteinOffset}
          setValue={(a: number) => (meal.proteinOffset = a)}
          iconClassName="egg"
        />
      </div>
    </div>
  );
}

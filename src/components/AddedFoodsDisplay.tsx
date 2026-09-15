import AddedFood from "./AddedFood";
import type Meal from "../models/events/meal";
import { EmptyState } from "./PageLayout";
import MdIcon from "./md3/MdIcon";

interface AddedFoodsDisplayProps {
  meal: Meal;
}
export default function AddedFoodsDisplay({ meal }: AddedFoodsDisplayProps) {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="app-card-title mb-0">
          <MdIcon name="shopping_basket" className="text-primary" size={20} />
          <span>Added Foods</span>
        </div>
        {meal.addedFoods.length > 0 && (
          <span
            className="badge bg-primary-subtle text-primary fw-semibold px-2 py-0.5 rounded-pill"
            style={{ fontSize: "0.72rem" }}
          >
            {meal.addedFoods.length}{" "}
            {meal.addedFoods.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {meal.addedFoods.length === 0 ? (
        <EmptyState>
          No foods added yet. Search above to add items to this meal.
        </EmptyState>
      ) : (
        <div className="app-food-list">
          {meal.addedFoods.map((food, i) => (
            <AddedFood key={i} food={food} meal={meal} />
          ))}
        </div>
      )}
    </div>
  );
}

import AddedFood from "./AddedFood";
import type Meal from "../models/events/meal";
import { EmptyState } from "./PageLayout";
import MdIcon from "./md3/MdIcon";

interface AddedFoodsDisplayProps {
  meal: Meal;
}
const nameOrder = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

export default function AddedFoodsDisplay({ meal }: AddedFoodsDisplayProps) {
  // Alphabetical by name. Each row is keyed by its name (plus which repeat it
  // is), not its position, so a row keeps its typed-in amount when a food
  // added later sorts in above it.
  const seen = new Map<string, number>();
  const sortedFoods = meal.addedFoods
    .sort((a, b) => nameOrder.compare(a.name, b.name))
    .map((food) => {
      const n = seen.get(food.name) ?? 0;
      seen.set(food.name, n + 1);
      return { food, key: `${food.name}#${n}` };
    });

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
          {sortedFoods.map(({ food, key }) => (
            <AddedFood key={key} food={food} meal={meal} />
          ))}
        </div>
      )}
    </div>
  );
}

import type Food from "../models/food";
import { getFoodUnitPrettyName } from "../models/unit";

export default function FoodDisplay({ food }: { food: Food }) {
  const prettyUnit = getFoodUnitPrettyName(food.unit);
  return (
    <div className="d-flex justify-content-between align-items-center py-1">
      <div>
        <span className="fw-semibold text-body">{food.name}</span>
        <div className="small text-muted" style={{ fontSize: "0.75rem" }}>
          Per {prettyUnit}
        </div>
      </div>
      <div className="d-flex align-items-center gap-2">
        <span
          className="badge bg-primary-subtle text-primary rounded-pill px-2 py-0.5"
          style={{ fontSize: "0.72rem" }}
        >
          {food.carbsRate}g carbs
        </span>
        <span
          className="badge bg-success-subtle text-success rounded-pill px-2 py-0.5"
          style={{ fontSize: "0.72rem" }}
        >
          {food.proteinRate}g prot
        </span>
      </div>
    </div>
  );
}

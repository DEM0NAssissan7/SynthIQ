import type Food from "../models/food";
import { getFoodUnitPrettyName } from "../models/unit";

export default function FoodDisplay({ food }: { food: Food }) {
  return (
    <div className="d-flex justify-content-between align-items-center">
      <span className="fw-bold">{food.name}</span>
      <span className="text-muted">
        {food.carbsRate}g carbs
        <br />
        {food.proteinRate}g protein
        <br />/{getFoodUnitPrettyName(food.unit)}
      </span>
    </div>
  );
}

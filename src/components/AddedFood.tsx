import { Form } from "react-bootstrap";
import { getFoodUnitPrettyName } from "../models/unit";
import { useMemo, type BaseSyntheticEvent } from "react";
import type Food from "../models/food";
import useFood from "../state/useFood";
import { round } from "../lib/util";
import type Meal from "../models/events/meal";

interface SearchFoodProps {
  food: Food;
  meal: Meal;
}

export default function AddedFood({ food, meal }: SearchFoodProps) {
  const prettyUnit = getFoodUnitPrettyName(food.unit);
  const letter = prettyUnit[prettyUnit.length - 1];
  const { amount, setAmount, carbs, protein, fiber, rise } = useFood(
    food,
    meal,
  );
  const netCarbs = useMemo(() => {
    return carbs - fiber;
  }, [carbs, fiber]);

  // Just to prevent reload when pressing enter
  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault();
  };

  function remove() {
    meal.removeFood(food);
  }

  return (
    <div className="app-food-row">
      <div className="food-main">
        <div className="food-name">{food.name}</div>
        <div className="food-macros">
          <span className="fw-semibold text-body-secondary">{round(carbs, 1)}g carbs</span>
          {carbs !== netCarbs && <span className="opacity-75"> ({round(netCarbs, 1)}g net)</span>}
          {protein !== 0 && <span>· {round(protein, 1)}g prot</span>}
          {rise !== 0 && <span className="text-warning-emphasis">· +{rise} mg/dL</span>}
        </div>
      </div>
      <div className="food-actions">
        <Form onSubmit={handleFormSubmit}>
          <div className="input-group food-input-group">
            <Form.Control
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="0"
              value={amount || ""}
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setAmount(value);
              }}
            />
            <span className="input-group-text">{letter}</span>
          </div>
        </Form>
        <button
          type="button"
          className="food-del-btn"
          onClick={remove}
          title="Remove food"
          aria-label="Remove food"
        >
          <i className="bi bi-trash3" />
        </button>
      </div>
    </div>
  );
}

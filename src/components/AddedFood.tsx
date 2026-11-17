import { Form } from "react-bootstrap";
import { getFoodUnitPrettyName } from "../models/unit";
import { useEffect, useMemo, useState, type BaseSyntheticEvent } from "react";
import type Food from "../models/food";
import useFood from "../state/useFood";
import { round } from "../lib/util";
import type Meal from "../models/events/meal";
import MdIcon from "./md3/MdIcon";

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

  // Keep the raw text locally so intermediate states like "-" or "-0." survive
  // while typing; the numeric amount is derived from it.
  const [text, setText] = useState(amount ? String(amount) : "");
  useEffect(() => {
    if ((parseFloat(text) || 0) !== amount) setText(amount ? String(amount) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  function updateText(value: string) {
    if (!/^-?\d*\.?\d*$/.test(value)) return;
    setText(value);
    setAmount(parseFloat(value) || 0);
  }

  // iOS decimal keypad has no minus key, so offer a sign toggle.
  function toggleSign() {
    updateText(text.startsWith("-") ? text.slice(1) : "-" + text);
  }

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
            <button
              type="button"
              className="input-group-text food-sign-btn"
              onClick={toggleSign}
              title="Toggle negative"
              aria-label="Toggle negative amount"
            >
              ±
            </button>
            <Form.Control
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={text}
              onChange={(e) => updateText(e.target.value.replace(",", "."))}
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
          <MdIcon name="delete" size={18} />
        </button>
      </div>
    </div>
  );
}

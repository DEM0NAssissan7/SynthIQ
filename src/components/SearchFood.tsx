import { Button, Form } from "react-bootstrap";
import { getFoodUnitPrettyName } from "../models/unit";
import { type BaseSyntheticEvent } from "react";
import type Food from "../models/food";
import useFood from "../state/useFood";

interface SearchFoodProps {
  food: Food;
  addFood: (food: Food) => void;
}

export default function SearchFood({ food, addFood }: SearchFoodProps) {
  const prettyUnit = getFoodUnitPrettyName(food.unit);
  const letter = prettyUnit[prettyUnit.length - 1];
  const { amount, setAmount } = useFood(food);

  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault();
    if (amount > 0) add();
  };

  function add() {
    addFood(food);
    setAmount(0);
  }

  return (
    <div className="app-food-row">
      <div className="food-main">
        <div className="food-name">{food.name}</div>
        <div className="food-macros">
          <span className="text-body-secondary">Per {prettyUnit}</span>
          {food.carbsRate !== 0 && (
            <span className="fw-semibold text-primary">· {food.carbsRate}g carbs</span>
          )}
          {food.proteinRate !== 0 && (
            <span>· {food.proteinRate}g prot</span>
          )}
          {food.arbitraryRise !== 0 && (
            <span className="text-warning-emphasis">· +{food.arbitraryRise} mg/dL</span>
          )}
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
        <Button
          variant="primary"
          size="sm"
          onClick={add}
          disabled={!amount || amount <= 0}
          className="d-inline-flex align-items-center gap-1"
          style={{ height: "2.2rem", padding: "0 0.65rem", fontSize: "0.85rem" }}
        >
          <i className="bi bi-plus-lg" />
          <span>Add</span>
        </Button>
      </div>
    </div>
  );
}

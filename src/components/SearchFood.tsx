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
    <div className="w-100">
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <span className="fw-semibold text-body fs-6">{food.name}</span>
          <div className="small text-muted">Per {prettyUnit}</div>
        </div>
        <div className="d-flex flex-wrap gap-1 justify-content-end">
          {food.carbsRate !== 0 && (
            <span className="badge bg-primary-subtle text-primary rounded-pill px-2 py-1">
              {food.carbsRate}g carbs
            </span>
          )}
          {food.proteinRate !== 0 && (
            <span className="badge bg-success-subtle text-success rounded-pill px-2 py-1">
              {food.proteinRate}g protein
            </span>
          )}
          {food.arbitraryRise !== 0 && (
            <span className="badge bg-warning-subtle text-warning-emphasis rounded-pill px-2 py-1">
              +{food.arbitraryRise} mg/dL
            </span>
          )}
        </div>
      </div>

      <Form onSubmit={handleFormSubmit}>
        <div className="d-flex align-items-center gap-2">
          <Form.Group controlId={`food-amount-${food.name}`} className="mb-0 flex-grow-1">
            <div className="input-group">
              <Form.Control
                type="number"
                placeholder="0"
                className="text-center fw-semibold"
                value={amount || ""}
                onInput={(e: BaseSyntheticEvent) => {
                  const value = parseFloat(e.target.value) || 0;
                  setAmount(value);
                }}
              />
              <span className="input-group-text small text-muted">
                {letter}
              </span>
            </div>
          </Form.Group>
          <Button
            variant="primary"
            onClick={add}
            disabled={!amount || amount <= 0}
            className="d-inline-flex align-items-center gap-1 px-3"
          >
            <i className="bi bi-plus-lg" />
            <span>Add</span>
          </Button>
        </div>
      </Form>
    </div>
  );
}

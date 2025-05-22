import { Button, Form } from "react-bootstrap";
import { getFoodUnitPrettyName } from "../models/unit";
import { type BaseSyntheticEvent } from "react";
import type Food from "../models/food";
import useFood from "../state/useFood";
import { round } from "../lib/util";
import { getInsulin } from "../lib/metabolism";
import type Meal from "../models/meal";

interface SearchFoodProps {
  food: Food;
  meal: Meal;
}

export default function AddedFood({ food, meal }: SearchFoodProps) {
  let prettyUnit = getFoodUnitPrettyName(food.unit);
  let letter = prettyUnit[prettyUnit.length - 1];
  const { amount, setAmount, carbs, protein } = useFood(food, meal);

  // Just to prevent reload when pressing enter
  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior
  };

  function remove() {
    meal.removeFood(food);
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center">
        <span className="fw-bold">{food.name}</span>
        <span className="text-muted">
          {round(carbs, 2)}g carbs
          <br />
          {round(protein, 2)}g protein
          <br />
          {round(getInsulin(carbs, protein), 2)}u insulin
        </span>
      </div>
      <Form onSubmit={handleFormSubmit}>
        <div className="d-flex align-items-center gap-2">
          <Form.Group controlId="food-amount" className="mb-0 flex-grow-1">
            <Form.Control
              type="number"
              placeholder={`Amount (${letter})`}
              className="text-center"
              value={amount || ""}
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setAmount(value);
              }}
            />
          </Form.Group>
          <Button variant="danger" onClick={remove}>
            Remove
          </Button>
        </div>
      </Form>
    </>
  );
}

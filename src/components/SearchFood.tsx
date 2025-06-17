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
  let prettyUnit = getFoodUnitPrettyName(food.unit);
  let letter = prettyUnit[prettyUnit.length - 1];
  const { amount, setAmount } = useFood(food);

  // Just to prevent reload when pressing enter
  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior
  };

  function add() {
    addFood(food);
    setAmount(0); // Reset amount after adding
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center">
        <span className="fw-bold">{food.name}</span>
        <span className="text-muted">
          {food.carbsRate}g carbs
          <br />
          {food.proteinRate}g protein
          <br />/{getFoodUnitPrettyName(food.unit)}
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
          <Button variant="secondary" onClick={add}>
            Add
          </Button>
        </div>
      </Form>
    </>
  );
}

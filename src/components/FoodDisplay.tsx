import { Button, Form, ListGroup } from "react-bootstrap";
import { getFoodUnitPrettyName } from "../models/unit";
import type { Food } from "../lib/food";
import { useState, type BaseSyntheticEvent } from "react";
import { getInsulin } from "../lib/metabolism";
import { round } from "../lib/util";

interface FoodDisplayProps {
  food: Food;
  onButtonPressed: Function;
  added: boolean;
  amount?: number;
  onAmountChanged?: Function;
}

export default function FoodDisplay({
  food,
  onButtonPressed,
  added,
  amount,
  onAmountChanged,
}: FoodDisplayProps) {
  const [val, setVal] = useState(amount);

  let prettyUnit = getFoodUnitPrettyName(food.unit);
  let letter = prettyUnit[prettyUnit.length - 1];

  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior
  };
  const handleButtonPress = () => {
    onButtonPressed(val);
  };

  const handleChange = (e: BaseSyntheticEvent) => {
    const value = parseFloat(e.target.value) || 0;
    setVal(value); // Update the state with the new value
    food.amount = value;
  };
  const handleInput = (e: BaseSyntheticEvent) => {
    if (added) {
      handleChange(e);
      const value = parseFloat(e.target.value) || 0;
      if (onAmountChanged) {
        onAmountChanged(value);
      }
    }
  };

  function getInitialValue() {
    if (added) return food.amount || "";
    return food.amount || "";
  }

  return (
    <ListGroup.Item key={food.name} className="d-flex flex-column gap-3 p-3">
      <div className="d-flex justify-content-between align-items-center">
        <span className="fw-bold">{food.name}</span>
        {added ? (
          <span className="text-muted">
            {round(food.getCarbs(), 2)}g carbs
            <br />
            {round(food.getProtein(), 2)}g protein
            <br />
            {round(getInsulin(food.getCarbs(), food.getProtein()), 2)}u insulin
          </span>
        ) : (
          <span className="text-muted">
            {food.carbsRate}g carbs
            <br />
            {food.proteinRate}g protein
            <br />/{getFoodUnitPrettyName(food.unit)}
          </span>
        )}
      </div>
      <Form onSubmit={handleFormSubmit}>
        <div className="d-flex align-items-center gap-2">
          <Form.Group controlId="food-amount" className="mb-0 flex-grow-1">
            <Form.Control
              type="number"
              placeholder={`Amount (${letter})`}
              className="text-center"
              value={getInitialValue()}
              onChange={handleChange}
              onInput={handleInput}
            />
          </Form.Group>
          {added ? (
            <Button variant="danger" onClick={handleButtonPress}>
              Remove
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleButtonPress}>
              Add
            </Button>
          )}
        </div>
      </Form>
    </ListGroup.Item>
  );
}

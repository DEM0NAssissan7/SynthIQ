import { Button, Form } from "react-bootstrap";
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
  let prettyUnit = getFoodUnitPrettyName(food.unit);
  let letter = prettyUnit[prettyUnit.length - 1];
  const { amount, setAmount, carbs, protein, fiber, rise } = useFood(
    food,
    meal
  );
  const netCarbs = useMemo(() => {
    return carbs - fiber;
  }, [carbs, fiber]);

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
          {carbs !== 0 && (
            <>
              {round(carbs, 2)}g carbs <br />
            </>
          )}
          {carbs !== netCarbs && (
            <>
              {round(netCarbs, 2)}g net carbs
              <br />
            </>
          )}
          {protein !== 0 && (
            <>
              {round(protein, 2)}g protein
              <br />
            </>
          )}
          {rise !== 0 && <>{rise}mg/dL rise</>}
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

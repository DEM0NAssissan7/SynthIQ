import { Button, Form, ListGroup } from "react-bootstrap";
import Card from "../components/Card";
import FoodDisplay from "../components/FoodDisplay";
import Food from "../models/food";
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import Unit, { getFoodUnitPrettyName } from "../models/unit";
import { CustomStore } from "../storage/customStore";

export default function CustomFoodsPage() {
  const [customFoods] = CustomStore.foods.useState();

  const [foodName, setFoodName] = useState("");
  const [carbsRate, setCarbsRate] = useState(0);
  const [proteinRate, setProteinRate] = useState(0);
  const [fiberRate, setFiberRate] = useState(0);
  const [rise, setRise] = useState(0);
  const [fatRate, setFatRate] = useState(0);
  const [unit, setUnit] = useState(Unit.Food.HundredGrams);

  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior
  };

  const prettyUnit = useMemo(() => {
    return getFoodUnitPrettyName(unit);
  }, [unit]);

  function resetUIStates() {
    setFoodName("");
    setCarbsRate(0);
    setProteinRate(0);
    setFiberRate(0);
    setFatRate(0);
    setRise(0);
    setUnit(Unit.Food.HundredGrams);
  }
  function add() {
    if (!foodName || foodName.trim() === "") {
      alert("Please enter a valid food name.");
      return;
    }
    const food = new Food(
      foodName,
      carbsRate,
      proteinRate,
      unit,
      rise,
      fatRate,
      fiberRate
    );
    CustomStore.addFood(food);
    resetUIStates();
    console.log(`Added ${foodName} to custom foods.`);
  }
  function removeFood(food: Food) {
    if (confirm(`Are you sure you want to remove '${food.name}'?`)) {
      CustomStore.removeFood(food);
      console.log(`Removed ${food.name} from custom foods.`);
    }
  }

  return (
    <>
      <div className="container">
        <h1>Custom Foods</h1>
        <Card>
          <Form onSubmit={handleFormSubmit}>
            <div className="d-flex align-items-center gap-2">
              <Form.Group controlId="food-amount" className="mb-0 flex-grow-1">
                Name:{" "}
                <Form.Control
                  type="text"
                  placeholder="e.g. Apple"
                  className="text-center"
                  value={foodName}
                  onInput={(e: BaseSyntheticEvent) => {
                    setFoodName(e.target.value);
                  }}
                />
                <br />
                <br />
                Denomination:
                <Form.Select
                  value={unit}
                  onChange={(e: BaseSyntheticEvent) =>
                    setUnit(parseInt(e.target.value))
                  }
                  className="mb-2"
                >
                  <option value={Unit.Food.HundredGrams}>per 100g</option>
                  <option value={Unit.Food.Unit}>per unit</option>
                </Form.Select>
                <br />
                carbs / {prettyUnit}:
                <Form.Control
                  type="number"
                  placeholder={`0g`}
                  className="text-center"
                  value={carbsRate || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    const value = parseFloat(e.target.value) || 0;
                    setCarbsRate(value);
                  }}
                />
                <br />
                fiber / {prettyUnit}:
                <Form.Control
                  type="number"
                  placeholder={`0g`}
                  className="text-center"
                  value={fiberRate || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    const value = parseFloat(e.target.value) || 0;
                    setFiberRate(value);
                  }}
                />
                <br />
                protein / {prettyUnit}:
                <Form.Control
                  type="number"
                  placeholder={`0g`}
                  className="text-center"
                  value={proteinRate || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    const value = parseFloat(e.target.value) || 0;
                    setProteinRate(value);
                  }}
                />
                <br />
                fat / {prettyUnit}:
                <Form.Control
                  type="number"
                  placeholder={`0g`}
                  className="text-center"
                  value={fatRate || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    const value = parseFloat(e.target.value) || 0;
                    setFatRate(value);
                  }}
                />
                <br />
                rise(arbitrary) / {prettyUnit}:
                <Form.Control
                  type="number"
                  placeholder={`0mg/dL`}
                  className="text-center"
                  value={rise || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    const value = parseFloat(e.target.value) || 0;
                    setRise(value);
                  }}
                />
                <br />
                <div className="d-flex justify-content-end">
                  <Button variant="primary" onClick={add}>
                    Add
                  </Button>
                </div>
              </Form.Group>
            </div>
          </Form>
        </Card>
        <Card>
          {customFoods.length === 0 && (
            <div className="text-muted">
              No custom foods added yet. Use the form above to add new custom
              foods.
            </div>
          )}
          <ListGroup className="mt-3">
            {customFoods.map((food, i) => (
              <ListGroup.Item key={i} className="d-flex flex-column gap-3 p-3">
                <FoodDisplay food={food} />
                <Button variant="danger" onClick={() => removeFood(food)}>
                  Remove
                </Button>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card>
      </div>
    </>
  );
}

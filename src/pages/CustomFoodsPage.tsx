import { Button, Form, ListGroup } from "react-bootstrap";
import Card from "../components/Card";
import FoodDisplay from "../components/FoodDisplay";
import Food from "../models/food";
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import Unit, { getFoodUnitPrettyName } from "../models/unit";
import { CustomStore } from "../storage/customStore";
import { EmptyState, PageHeader, PageLayout } from "../components/PageLayout";

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
    <PageLayout>
      <PageHeader
        eyebrow="Customization"
        title="Custom foods"
        subtitle="Add your repeat foods here so meal building stays fast without losing macro detail."
      />
      <Card>
        <div className="app-card-title">
          <i className="bi bi-plus-circle"></i>
          <span>New custom food</span>
        </div>
        <Form onSubmit={handleFormSubmit}>
          <div className="d-grid gap-2">
            <div>
              <Form.Label className="small text-muted mb-1">Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Oatmeal with blueberries"
                value={foodName}
                onInput={(e: BaseSyntheticEvent) => {
                  setFoodName(e.target.value);
                }}
              />
            </div>
            <div>
              <Form.Label className="small text-muted mb-1">Denomination</Form.Label>
              <Form.Select
                value={unit}
                onChange={(e: BaseSyntheticEvent) =>
                  setUnit(parseInt(e.target.value))
                }
              >
                <option value={Unit.Food.HundredGrams}>per 100g</option>
                <option value={Unit.Food.Unit}>per unit</option>
              </Form.Select>
            </div>

            <div className="row g-2 mt-1">
              <div className="col-6">
                <Form.Label className="small text-muted mb-1">Carbs / {prettyUnit}</Form.Label>
                <Form.Control
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="0g"
                  value={carbsRate || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    setCarbsRate(parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
              <div className="col-6">
                <Form.Label className="small text-muted mb-1">Fiber / {prettyUnit}</Form.Label>
                <Form.Control
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="0g"
                  value={fiberRate || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    setFiberRate(parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
              <div className="col-6">
                <Form.Label className="small text-muted mb-1">Protein / {prettyUnit}</Form.Label>
                <Form.Control
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="0g"
                  value={proteinRate || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    setProteinRate(parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
              <div className="col-6">
                <Form.Label className="small text-muted mb-1">Fat / {prettyUnit}</Form.Label>
                <Form.Control
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="0g"
                  value={fatRate || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    setFatRate(parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
              <div className="col-12">
                <Form.Label className="small text-muted mb-1">
                  Rise (arbitrary) / {prettyUnit}
                </Form.Label>
                <Form.Control
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="0 mg/dL"
                  value={rise || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    setRise(parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
            </div>

            <div className="d-grid mt-2">
              <Button variant="primary" onClick={add}>
                Add food
              </Button>
            </div>
          </div>
        </Form>
      </Card>
      <Card>
        <div className="app-card-title">
          <i className="bi bi-collection"></i>
          <span>Saved foods</span>
        </div>
        {customFoods.length === 0 && (
          <EmptyState>
            No custom foods added yet. Use the form above to build your first reusable food entry.
          </EmptyState>
        )}
        {customFoods.length > 0 && (
          <ListGroup variant="flush">
            {customFoods.map((food, i) => (
              <ListGroup.Item key={i} className="d-flex flex-column gap-3 p-3">
                <FoodDisplay food={food} />
                <Button variant="danger" size="sm" onClick={() => removeFood(food)}>
                  Remove
                </Button>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card>
    </PageLayout>
  );
}

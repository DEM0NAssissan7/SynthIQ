import { Button, Form, ListGroup, Modal } from "react-bootstrap";
import { useMemo, useState } from "react";
import Food, { foods } from "../models/food";
import SearchFood from "./SearchFood";
import type Meal from "../models/events/meal";
import Unit, { getFoodUnitPrettyName } from "../models/unit";
import { CustomStore } from "../storage/customStore";

interface FoodSearchDisplayProps {
  meal: Meal;
}

export default function FoodSearchDisplay({ meal }: FoodSearchDisplayProps) {
  const [query, setQuery] = useState("");
  const [customFoodsList] = CustomStore.foods.useState();

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFoodName, setNewFoodName] = useState("");
  const [newUnit, setNewUnit] = useState<Unit.Food>(Unit.Food.HundredGrams);
  const [newCarbs, setNewCarbs] = useState<number | "">("");
  const [newFiber, setNewFiber] = useState<number | "">("");
  const [newProtein, setNewProtein] = useState<number | "">("");
  const [newFat, setNewFat] = useState<number | "">("");
  const [newRise, setNewRise] = useState<number | "">("");
  const [amountToAdd, setAmountToAdd] = useState<number | "">("");

  function openAddModal() {
    setNewFoodName(query.trim());
    setNewUnit(Unit.Food.HundredGrams);
    setNewCarbs("");
    setNewFiber("");
    setNewProtein("");
    setNewFat("");
    setNewRise("");
    setAmountToAdd(100);
    setShowAddModal(true);
  }

  function handleUnitChange(selectedUnit: Unit.Food) {
    setNewUnit(selectedUnit);
    if (selectedUnit === Unit.Food.HundredGrams) {
      setAmountToAdd(100);
    } else {
      setAmountToAdd(1);
    }
  }

  function addMealFood(food: Food, amount: number) {
    const newFood = new Food(
      food.name,
      food.carbsRate,
      food.proteinRate,
      food.unit,
      food.arbitraryRise,
      food.fatRate,
      food.fiberRate
    );
    newFood.amount = amount;
    meal.addFood(newFood);
    setQuery("");
  }

  function handleSaveCustomFood(andAddToMeal: boolean) {
    const trimmedName = newFoodName.trim();
    if (!trimmedName) {
      alert("Please enter a valid food name.");
      return;
    }

    const food = new Food(
      trimmedName,
      Number(newCarbs) || 0,
      Number(newProtein) || 0,
      newUnit,
      Number(newRise) || 0,
      Number(newFat) || 0,
      Number(newFiber) || 0
    );

    CustomStore.addFood(food);

    if (andAddToMeal) {
      const defaultQty = newUnit === Unit.Food.HundredGrams ? 100 : 1;
      const qty = Number(amountToAdd) > 0 ? Number(amountToAdd) : defaultQty;
      addMealFood(food, qty);
    } else {
      setQuery(food.name);
    }

    setShowAddModal(false);
  }

  const prettyUnit = useMemo(() => {
    return getFoodUnitPrettyName(newUnit);
  }, [newUnit]);

  const filteredFoods = useMemo(() => {
    if (query.length === 0) return [];
    let result: Food[] = [];
    let i = 0;
    for (let f of foods) {
      if (f.name.toLowerCase().includes(query.trim().toLowerCase())) {
        f.key = i;
        i++;
        result.push(f);
      }
    }
    return result;
  }, [query, customFoodsList]);

  return (
    <>
      <Form onSubmit={(e) => e.preventDefault()}>
        <Form.Group controlId="food-search" className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Form.Label className="mb-0 fw-semibold">Food Search</Form.Label>
            <Button
              variant="link"
              size="sm"
              className="p-0 text-decoration-none fw-semibold d-inline-flex align-items-center gap-1"
              onClick={openAddModal}
            >
              <i className="bi bi-plus-circle-fill text-primary" />
              <span>New Food</span>
            </Button>
          </div>

          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search" />
            </span>
            <Form.Control
              type="text"
              placeholder="Search any food..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              variant="outline-primary"
              onClick={openAddModal}
              title="Create a new custom food"
              className="d-flex align-items-center gap-1"
            >
              <i className="bi bi-plus-lg" />
              <span className="d-none d-sm-inline">New</span>
            </Button>
          </div>
        </Form.Group>
      </Form>

      <ListGroup>
        {filteredFoods.map((food: Food, i: number) => (
          <ListGroup.Item key={i} className="d-flex flex-column gap-3 p-3">
            <SearchFood
              food={food}
              addFood={(f: Food) => {
                addMealFood(f, f.amount);
              }}
            />
          </ListGroup.Item>
        ))}

        {filteredFoods.length === 0 && query.length !== 0 && (
          <ListGroup.Item className="d-flex justify-content-between align-items-center p-3 text-muted">
            <div>
              <span>No matches for &ldquo;{query}&rdquo;</span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={openAddModal}
              className="d-inline-flex align-items-center gap-1"
            >
              <i className="bi bi-plus-lg" />
              <span>Add Custom</span>
            </Button>
          </ListGroup.Item>
        )}
      </ListGroup>

      {/* Quick Add Food Modal */}
      <Modal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        centered
        className="app-modal"
      >
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h5 fw-bold d-flex align-items-center gap-2">
            <i className="bi bi-egg-fried text-primary" />
            <span>Create New Food</span>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="py-3">
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveCustomFood(true);
            }}
          >
            <Form.Group className="mb-3" controlId="modal-food-name">
              <Form.Label className="small fw-semibold">Food Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Protein Shake, Apple, Rice..."
                value={newFoodName}
                onChange={(e) => setNewFoodName(e.target.value)}
                autoFocus
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="modal-food-unit">
              <Form.Label className="small fw-semibold">
                Serving Basis
              </Form.Label>
              <Form.Select
                value={newUnit}
                onChange={(e) => handleUnitChange(parseInt(e.target.value))}
              >
                <option value={Unit.Food.HundredGrams}>Per 100g</option>
                <option value={Unit.Food.Unit}>Per unit / item</option>
              </Form.Select>
            </Form.Group>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <Form.Group controlId="modal-food-carbs">
                  <Form.Label className="small fw-semibold">
                    Carbs / {prettyUnit}
                  </Form.Label>
                  <div className="input-group">
                    <Form.Control
                      type="number"
                      step="any"
                      placeholder="0"
                      value={newCarbs}
                      onChange={(e) =>
                        setNewCarbs(
                          e.target.value === ""
                            ? ""
                            : parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    <span className="input-group-text small">g</span>
                  </div>
                </Form.Group>
              </div>

              <div className="col-6">
                <Form.Group controlId="modal-food-fiber">
                  <Form.Label className="small fw-semibold">
                    Fiber / {prettyUnit}
                  </Form.Label>
                  <div className="input-group">
                    <Form.Control
                      type="number"
                      step="any"
                      placeholder="0"
                      value={newFiber}
                      onChange={(e) =>
                        setNewFiber(
                          e.target.value === ""
                            ? ""
                            : parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    <span className="input-group-text small">g</span>
                  </div>
                </Form.Group>
              </div>

              <div className="col-6">
                <Form.Group controlId="modal-food-protein">
                  <Form.Label className="small fw-semibold">
                    Protein / {prettyUnit}
                  </Form.Label>
                  <div className="input-group">
                    <Form.Control
                      type="number"
                      step="any"
                      placeholder="0"
                      value={newProtein}
                      onChange={(e) =>
                        setNewProtein(
                          e.target.value === ""
                            ? ""
                            : parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    <span className="input-group-text small">g</span>
                  </div>
                </Form.Group>
              </div>

              <div className="col-6">
                <Form.Group controlId="modal-food-fat">
                  <Form.Label className="small fw-semibold">
                    Fat / {prettyUnit}
                  </Form.Label>
                  <div className="input-group">
                    <Form.Control
                      type="number"
                      step="any"
                      placeholder="0"
                      value={newFat}
                      onChange={(e) =>
                        setNewFat(
                          e.target.value === ""
                            ? ""
                            : parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    <span className="input-group-text small">g</span>
                  </div>
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3" controlId="modal-food-rise">
              <Form.Label className="small fw-semibold">
                Extra Rise (optional) / {prettyUnit}
              </Form.Label>
              <div className="input-group">
                <Form.Control
                  type="number"
                  step="any"
                  placeholder="0"
                  value={newRise}
                  onChange={(e) =>
                    setNewRise(
                      e.target.value === ""
                        ? ""
                        : parseFloat(e.target.value) || 0,
                    )
                  }
                />
                <span className="input-group-text small">mg/dL</span>
              </div>
            </Form.Group>

            <div className="border-top pt-3 mt-3">
              <Form.Group controlId="modal-food-amount">
                <Form.Label className="small fw-semibold">
                  Amount to add to meal now
                </Form.Label>
                <div className="input-group">
                  <Form.Control
                    type="number"
                    step="any"
                    placeholder={
                      newUnit === Unit.Food.HundredGrams ? "100" : "1"
                    }
                    value={amountToAdd}
                    onChange={(e) =>
                      setAmountToAdd(
                        e.target.value === ""
                          ? ""
                          : parseFloat(e.target.value) || 0,
                      )
                    }
                  />
                  <span className="input-group-text small">
                    {newUnit === Unit.Food.HundredGrams ? "g" : "unit(s)"}
                  </span>
                </div>
              </Form.Group>
            </div>
          </Form>
        </Modal.Body>

        <Modal.Footer className="border-0 pt-0 gap-2">
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button
            variant="outline-primary"
            onClick={() => handleSaveCustomFood(false)}
          >
            Save Food
          </Button>
          <Button
            variant="primary"
            onClick={() => handleSaveCustomFood(true)}
            className="fw-semibold"
          >
            Save &amp; Add to Meal
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

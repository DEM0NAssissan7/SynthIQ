import { Form, ListGroup } from "react-bootstrap";
import { useMemo, useState } from "react";
import Food, { foods } from "../models/food";
import SearchFood from "./SearchFood";
import type Meal from "../models/events/meal";

interface FoodSearchDisplayProps {
  meal: Meal; // Replace with the correct type for meal
}

export default function FoodSearchDisplay({ meal }: FoodSearchDisplayProps) {
  const [query, setQuery] = useState("");

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
  }, [query]);

  return (
    <>
      <Form>
        <Form.Group controlId="food-search" className="mb-3">
          <Form.Label>Food Search</Form.Label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>{" "}
            </span>
            <Form.Control
              type="text"
              placeholder="Search any food..."
              value={query} // controlled value
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </Form.Group>
      </Form>

      <ListGroup>
        {filteredFoods.map((food: Food, i: number) => (
          <ListGroup.Item key={i} className="d-flex flex-column gap-3 p-3">
            <SearchFood
              food={food}
              addFood={(food: Food) => {
                addMealFood(food, food.amount);
              }}
            />
          </ListGroup.Item>
        ))}

        {filteredFoods.length === 0 && query.length !== 0 && (
          <ListGroup.Item className="text-muted">No matches</ListGroup.Item>
        )}
      </ListGroup>
    </>
  );
}

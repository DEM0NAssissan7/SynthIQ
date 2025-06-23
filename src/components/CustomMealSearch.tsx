import { useMemo, useState, type BaseSyntheticEvent } from "react";
import Meal from "../models/events/meal";
import { addCustomMeal, customStore } from "../storage/customStore";
import { Button, Form, ListGroup } from "react-bootstrap";

export default function CustomMealSearch({
  onChange,
  meal,
}: {
  onChange: (meal: Meal) => void;
  meal: Meal; // We need the meal to be able to save it
}) {
  const [query, setQuery] = useState("");

  const filteredMeals: Meal[] = useMemo(() => {
    if (query.length === 0) return [];
    let result: Meal[] = [];
    const meals = customStore.get("meals");
    let i = 0;
    for (let m of meals) {
      if (m.name.toLowerCase().includes(query.trim().toLowerCase())) {
        m.key = i;
        i++;
        result.push(m);
      }
    }
    return result;
  }, [query]);

  // Just to prevent reload when pressing enter
  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior
  };

  function saveMeal() {
    const name = prompt(
      "What would you like to name your meal? (enter nothing to cancel)"
    );
    if (name) {
      const newMeal = Meal.parse(Meal.stringify(meal));
      newMeal.name = name;
      addCustomMeal(newMeal);
    }
  }

  return (
    <>
      <Form>
        <Form.Group controlId="food-search" className="mb-3">
          <Form.Label>Custom Meals</Form.Label>
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
        {filteredMeals.map((meal: Meal, i: number) => (
          <ListGroup.Item key={i} className="d-flex flex-column gap-3 p-3">
            <div className="d-flex justify-content-between align-items-center">
              <span className="fw-bold">{meal.name}</span>
              <span className="text-muted">
                {meal.carbs}g carbs
                <br />
                {meal.protein}g protein
                <br />
              </span>
            </div>
            <Form onSubmit={handleFormSubmit}>
              <div className="d-flex align-items-center gap-2">
                <Form.Group
                  controlId="food-amount"
                  className="mb-0 flex-grow-1"
                ></Form.Group>
                <Button variant="primary" onClick={() => onChange(meal)}>
                  Load
                </Button>
              </div>
            </Form>
          </ListGroup.Item>
        ))}

        {filteredMeals.length === 0 && query.length !== 0 && (
          <ListGroup.Item className="text-muted">No matches</ListGroup.Item>
        )}
      </ListGroup>
      <div className="pt-3 d-flex justify-content-end">
        <Button variant="primary" onClick={saveMeal}>
          Save Current Meal
        </Button>
      </div>
    </>
  );
}

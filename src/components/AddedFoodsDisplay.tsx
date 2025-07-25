import { Form, ListGroup } from "react-bootstrap";
import AddedFood from "./AddedFood";
import type Meal from "../models/events/meal";

interface AddedFoodsDisplayProps {
  meal: Meal;
}
export default function AddedFoodsDisplay({ meal }: AddedFoodsDisplayProps) {
  return (
    <ListGroup>
      <Form.Label>Foods</Form.Label>
      {meal.addedFoods.map((food, i) => (
        <ListGroup.Item key={i} className="d-flex flex-column gap-3 p-3">
          <AddedFood food={food} meal={meal} key={i} />
        </ListGroup.Item>
      ))}
      {meal.addedFoods.length === 0 && (
        <ListGroup.Item className="text-muted">
          No foods added. Use the search box above to search for foods you're
          going to eat.
        </ListGroup.Item>
      )}
    </ListGroup>
  );
}

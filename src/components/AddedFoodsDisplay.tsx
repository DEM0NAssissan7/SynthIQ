import { Form, ListGroup } from "react-bootstrap";
import AddedFood from "./AddedFood";
import { useWizardMeal } from "../state/useMeal";

export default function AddedFoodsDisplay() {
  const meal = useWizardMeal();
  return (
    <ListGroup>
      <Form.Label>Foods</Form.Label>
      {meal.addedFoods.map((food) => (
        <ListGroup.Item
          key={food.name}
          className="d-flex flex-column gap-3 p-3"
        >
          <AddedFood food={food} key={food.key} />
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

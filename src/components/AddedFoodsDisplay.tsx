import { Form, ListGroup } from "react-bootstrap";
import AddedFood from "./AddedFood";
import { useWizardMealState } from "../state/useWizardMeal";

export default function AddedFoodsDisplay() {
  const { addedFoods } = useWizardMealState();
  return (
    <ListGroup>
      <Form.Label>Foods</Form.Label>
      {addedFoods.map((food) => (
        <ListGroup.Item
          key={food.name}
          className="d-flex flex-column gap-3 p-3"
        >
          <AddedFood food={food} key={food.key} />
        </ListGroup.Item>
      ))}
      {addedFoods.length === 0 && (
        <ListGroup.Item className="text-muted">
          No foods added. Use the search box above to search for foods you're
          going to eat.
        </ListGroup.Item>
      )}
    </ListGroup>
  );
}

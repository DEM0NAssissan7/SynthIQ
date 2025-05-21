import { Form, ListGroup } from "react-bootstrap";
import Food from "../models/food";
import AddedFood from "./AddedFood";

interface AddedFoodsDisplayProps {
  foods: Food[];
  removeFood: Function;
  changeFoodAmount: Function;
}

export default function AddedFoodsDisplay({
  foods,
  removeFood,
}: AddedFoodsDisplayProps) {
  return (
    <ListGroup>
      <Form.Label>Foods</Form.Label>
      {foods.map((food) => (
        <ListGroup.Item
          key={food.name}
          className="d-flex flex-column gap-3 p-3"
        >
          <AddedFood
            food={food}
            key={food.name}
            removeFood={() => {
              removeFood(food);
            }}
          />
        </ListGroup.Item>
      ))}
      {foods.length === 0 && (
        <ListGroup.Item className="text-muted">
          No foods added. Use the search box above to search for foods you're
          going to eat.
        </ListGroup.Item>
      )}
    </ListGroup>
  );
}

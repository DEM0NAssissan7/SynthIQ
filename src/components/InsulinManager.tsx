import { Button, Form, ListGroup } from "react-bootstrap";
import type Insulin from "../models/insulin";
import type Meal from "../models/meal";
import AddedInsulin from "./AddedInsulin";

interface InsulinManagerProps {
    meal: Meal;
}

export default function InsulinManager({ meal }: InsulinManagerProps) {
    function addInsulin() {
        meal.createInsulin(new Date(), 0);
    }
    return (
    <ListGroup>
      <Form.Label>Insulin Shots</Form.Label>
      <Button variant="primary" onClick={addInsulin}>Add</Button>
        {meal.insulins.map((insulin: Insulin, i: number) => {
        return <ListGroup.Item
            key={i}
            className="d-flex flex-column gap-3 p-3"
        >
            <AddedInsulin meal={meal} insulin={insulin}/>
        </ListGroup.Item>
        })}
    </ListGroup>
    )
}
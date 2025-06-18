import { Button, Form, ListGroup } from "react-bootstrap";
import type Insulin from "../models/insulin";
import AddedInsulin from "./AddedInsulin";
import type MetaEvent from "../models/event";

interface InsulinManagerProps {
  event: MetaEvent;
}

export default function InsulinManager({ event }: InsulinManagerProps) {
  function addInsulin() {
    event.createInsulin(new Date(), 0);
  }
  return (
    <ListGroup>
      <Form.Label>Insulin Shots</Form.Label>
      <Button variant="primary" onClick={addInsulin} className="mb-3">
        Add
      </Button>
      {event.insulins.map((insulin: Insulin, i: number) => {
        return (
          <ListGroup.Item key={i} className="d-flex flex-column gap-3 p-3">
            <AddedInsulin event={event} insulin={insulin} />
          </ListGroup.Item>
        );
      })}
    </ListGroup>
  );
}

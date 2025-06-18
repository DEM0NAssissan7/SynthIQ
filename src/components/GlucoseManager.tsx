import { Button, Form, ListGroup } from "react-bootstrap";
import type MetaEvent from "../models/event";
import type Glucose from "../models/glucose";
import AddedGlucose from "./AddedGlucose";

interface GlucoseManagerProps {
  event: MetaEvent;
}

export default function GlucoseManager({ event }: GlucoseManagerProps) {
  function addGlucose() {
    event.createGlucose(new Date(), 0);
  }
  return (
    <ListGroup>
      <Form.Label>Glucose Corrections</Form.Label>
      <Button variant="primary" onClick={addGlucose} className="mb-3">
        Add
      </Button>
      {event.glucoses.map((glucose: Glucose, i: number) => {
        return (
          <ListGroup.Item key={i} className="d-flex flex-column gap-3 p-3">
            <AddedGlucose event={event} glucose={glucose} />
          </ListGroup.Item>
        );
      })}
    </ListGroup>
  );
}

import { Button, Form, ListGroup } from "react-bootstrap";
import type Session from "../models/session";
import AddedGlucose from "./AddedGlucose";
import type Glucose from "../models/events/glucose";
import { RescueVariantManager } from "../managers/rescueVariantManager";

interface GlucoseManagerProps {
  session: Session;
}

export default function GlucoseManager({ session }: GlucoseManagerProps) {
  function addGlucose() {
    session.createGlucose(0, new Date(), RescueVariantManager.getDefault());
  }
  return (
    <ListGroup>
      <Form.Label>Glucose Corrections</Form.Label>
      <Button variant="primary" onClick={addGlucose} className="mb-3">
        Add
      </Button>
      {session.glucoses.map((glucose: Glucose, i: number) => {
        return (
          <ListGroup.Item key={i} className="d-flex flex-column gap-3 p-3">
            <AddedGlucose session={session} glucose={glucose} />
          </ListGroup.Item>
        );
      })}
    </ListGroup>
  );
}

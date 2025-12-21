import { Button, Form, ListGroup } from "react-bootstrap";
import type Insulin from "../models/events/insulin";
import AddedInsulin from "./AddedInsulin";
import type Session from "../models/session";
import { useState } from "react";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import InsulinVariantDropdown from "./InsulinVariantDropdown";

interface InsulinManagerProps {
  session: Session;
}

export default function InsulinManager({ session }: InsulinManagerProps) {
  const [variant, setVariant] = useState(InsulinVariantManager.getDefault());
  function addInsulin() {
    session.createInsulin(0, new Date(), variant);
  }
  return (
    <ListGroup>
      <Form.Label>Insulin Shots</Form.Label>
      <Form.Group className="mb-3">
        <InsulinVariantDropdown variant={variant} setVariant={setVariant} />
        <Button variant="primary" onClick={addInsulin}>
          Add
        </Button>
      </Form.Group>
      {session.insulins.map((insulin: Insulin, i: number) => {
        return (
          <ListGroup.Item key={i} className="d-flex flex-column gap-3 p-3">
            <AddedInsulin session={session} insulin={insulin} />
          </ListGroup.Item>
        );
      })}
    </ListGroup>
  );
}

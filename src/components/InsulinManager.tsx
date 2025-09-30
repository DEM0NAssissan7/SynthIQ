import { Button, Form, ListGroup } from "react-bootstrap";
import type Insulin from "../models/events/insulin";
import AddedInsulin from "./AddedInsulin";
import type Session from "../models/session";
import { useState } from "react";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { InsulinVariantStore } from "../storage/insulinVariantStore";

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
        <Form.Label>Variant</Form.Label>
        <Form.Select
          onChange={(e) => {
            // You can handle insulin type selection here if needed
            const v = InsulinVariantManager.getVariant(e.target.value);
            if (v) setVariant(v);
          }}
          className="mb-2"
        >
          {InsulinVariantStore.variants.value.map((v) => (
            <option value={v.name}>{v.name}</option>
          ))}
        </Form.Select>
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

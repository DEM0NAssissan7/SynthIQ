import { Button, Form, ListGroup } from "react-bootstrap";
import type Insulin from "../models/events/insulin";
import AddedInsulin from "./AddedInsulin";
import type Session from "../models/session";

interface InsulinManagerProps {
  session: Session;
}

export default function InsulinManager({ session }: InsulinManagerProps) {
  function addInsulin() {
    session.createInsulin(new Date(), 0);
  }
  return (
    <ListGroup>
      <Form.Label>Insulin Shots</Form.Label>
      <Button variant="primary" onClick={addInsulin} className="mb-3">
        Add
      </Button>
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

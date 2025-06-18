import { Form } from "react-bootstrap";
import SessionGraph from "./SessionGraph";
import type Session from "../models/session";
import Card from "./Card";

interface SessionPredictedSugarGraphCardProps {
  session: Session;
}
export default function SessionPredictedSugarGraphCard({
  session,
}: SessionPredictedSugarGraphCardProps) {
  return (
    <Card>
      <Form.Label>Predicted Blood Sugar</Form.Label>
      <SessionGraph session={session} from={-1} until={12} width="100%" />
    </Card>
  );
}

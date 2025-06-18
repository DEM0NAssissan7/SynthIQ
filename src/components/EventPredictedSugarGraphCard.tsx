import { Form } from "react-bootstrap";
import EventGraph from "./EventGraph";
import type MetaEvent from "../models/event";
import Card from "./Card";

interface EventPredictedSugarGraphCardProps {
  event: MetaEvent;
}
export default function EventPredictedSugarGraphCard({
  event,
}: EventPredictedSugarGraphCardProps) {
  return (
    <Card>
      <Form.Label>Predicted Blood Sugar</Form.Label>
      <EventGraph event={event} from={-1} until={12} width="100%" />
    </Card>
  );
}

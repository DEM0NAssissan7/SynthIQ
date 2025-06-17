import { Form } from "react-bootstrap";
import EventGraph from "./EventGraph";
import type MetaEvent from "../models/event";

interface EventPredictedSugarGraphCardProps {
  event: MetaEvent;
}
export default function EventPredictedSugarGraphCard({
  event,
}: EventPredictedSugarGraphCardProps) {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <Form.Label>Predicted Blood Sugar</Form.Label>
        <EventGraph event={event} from={-1} until={16} width="100%" />
      </div>
    </div>
  );
}

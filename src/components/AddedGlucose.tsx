import { Button, Form } from "react-bootstrap";
import { type BaseSyntheticEvent } from "react";
import { getHoursMinutes, round } from "../lib/util";
import type MetaEvent from "../models/event";
import useGlucose from "../state/useGlucose";
import type Glucose from "../models/glucose";

interface AddedGlucoseProps {
  glucose: Glucose;
  event: MetaEvent;
}

export default function AddedGlucose({ glucose, event }: AddedGlucoseProps) {
  // Just to prevent reload when pressing enter
  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior
  };

  const { caps, offset, setCaps, setTimestampFromOffset } = useGlucose(
    glucose,
    event
  );
  function remove() {
    event.removeGlucose(glucose);
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center">
        <span className="fw-bold">{round(glucose.caps, 2)}u</span>
        <span className="text-muted">
          Taken {getHoursMinutes(Math.abs(offset))}{" "}
          {offset > 0 ? "after" : "before"} eating
        </span>
      </div>
      <Form onSubmit={handleFormSubmit}>
        <Form.Group controlId="amount" className="mb-3">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-capsule"></i>
            </span>
            <Form.Control
              type="number"
              placeholder="Caps/Carbs"
              className="text-center"
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setCaps(value);
              }}
            />
          </div>
        </Form.Group>
        <Form.Group controlId="time" className="mb-3">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-clock"></i>
            </span>

            <Form.Control
              type="number"
              placeholder="Delay (minutes after meal)"
              className="text-center"
              onChange={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                if (value || value === 0) setTimestampFromOffset(value);
              }}
            />
          </div>
        </Form.Group>
        <Button variant="danger" onClick={remove}>
          Remove
        </Button>
      </Form>
    </>
  );
}

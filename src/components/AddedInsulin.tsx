import { Button, Form } from "react-bootstrap";
import { type BaseSyntheticEvent } from "react";
import { getHoursMinutes, round } from "../lib/util";
import type Meal from "../models/meal";
import type Insulin from "../models/insulin";
import useInsulin from "../state/useInsulin";

interface AddedInsulinProps {
  insulin: Insulin;
  meal: Meal;
}

export default function AddedInsulin({ insulin, meal }: AddedInsulinProps) {
  // Just to prevent reload when pressing enter
  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior
  };

  const { units, offset, setUnits, setTimestampFromOffset } = useInsulin(
    insulin,
    meal
  );
  function remove() {
    meal.removeInsulin(insulin);
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center">
        <span className="fw-bold">{round(insulin.units, 2)}u</span>
        <span className="text-muted">
          Taken {getHoursMinutes(Math.abs(offset))}{" "}
          {offset > 0 ? "after" : "before"} eating
        </span>
      </div>
      <Form onSubmit={handleFormSubmit}>
        <Form.Group controlId="insulin-amount" className="mb-3">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-capsule"></i>
            </span>
            <Form.Control
              type="number"
              placeholder="Units"
              className="text-center"
              value={units || ""}
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setUnits(value);
              }}
            />
          </div>
        </Form.Group>
        <Form.Group controlId="insulin-time" className="mb-3">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-clock"></i>
            </span>

            <Form.Control
              type="number"
              placeholder="Delay (hours after meal)"
              className="text-center"
              value={offset || ""}
              onChange={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setTimestampFromOffset(value);
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

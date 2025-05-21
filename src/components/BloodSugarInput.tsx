import { Button, Form, ListGroup } from "react-bootstrap";
import NightscoutManager from "../lib/nightscoutManager";

interface BloodSugarInputProps {
  initialGlucose: number;
  setInitialGlucose: (value: number) => void;
}

export default function BloodSugarInput({
  initialGlucose,
  setInitialGlucose,
}: BloodSugarInputProps) {
  function pullCurrentGlucose() {
    NightscoutManager.getCurrentSugar().then((g) => {
      setInitialGlucose(g);
    });
  }
  return (
    <Form.Group controlId="current-glucose" className="mb-3">
      <Form.Label className="text-muted">Current Blood Sugar</Form.Label>
      <div className="input-group">
        <span className="input-group-text">
          <i className="bi bi-droplet"></i>
        </span>
        <Form.Control
          type="number"
          value={initialGlucose || ""} // controlled value
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            setInitialGlucose(!isNaN(value) ? value : 0);
          }}
        />
        <Button variant="primary" onClick={pullCurrentGlucose}>
          Auto
        </Button>
      </div>
    </Form.Group>
  );
}

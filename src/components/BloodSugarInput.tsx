import { Button, Form } from "react-bootstrap";
import { useEffect } from "react";
import RemoteReadings from "../lib/remote/readings";

interface BloodSugarInputProps {
  initialGlucose: number;
  setInitialGlucose: (value: number) => void;
  pullFromNightscout?: boolean;
  showAutoButton?: boolean;
}

export default function BloodSugarInput({
  initialGlucose,
  setInitialGlucose,
  pullFromNightscout = true,
  showAutoButton = true,
}: BloodSugarInputProps) {
  function pullCurrentGlucose() {
    RemoteReadings.getCurrentSugar().then((g) => {
      setInitialGlucose(g);
    });
  }
  useEffect(() => {
    if (pullFromNightscout) pullCurrentGlucose(); // Pull glucose upon component load
  }, []);
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
        {showAutoButton && (
          <Button variant="primary" onClick={pullCurrentGlucose}>
            Auto
          </Button>
        )}
      </div>
    </Form.Group>
  );
}

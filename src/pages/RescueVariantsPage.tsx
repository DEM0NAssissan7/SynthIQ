import { Button, Form, ListGroup } from "react-bootstrap";
import Card from "../components/Card";
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import { RescueVariantStore } from "../storage/rescueVariantStore";
import { RescueVariantManager as RescueVariantManager } from "../managers/rescueVariantManager";
import type { RescueVariant } from "../models/types/rescueVariant";

export default function RescueVariantsPage() {
  const [variants] = RescueVariantStore.variants.useState();

  const [name, setName] = useState("");
  const [effect, setEffect] = useState(0);
  const [duration, setDuration] = useState(0);

  const isValid = useMemo(
    () => name.length > 0 && duration && effect,
    [name, duration, effect]
  );

  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior
  };

  function resetUIStates() {
    setName("");
    setEffect(0);
    setDuration(0);
  }
  function add() {
    if (!name || name.trim() === "") {
      alert("Enter a valid name.");
      return;
    }
    if (!duration) {
      alert("Enter a valid duration");
      return;
    }
    if (!effect) {
      alert("Enter a valid effect");
      return;
    }
    RescueVariantManager.createVariant(name, duration, effect);
    resetUIStates();
    console.log(`Added ${name} to custom foods.`);
  }
  function removeVariant(v: RescueVariant) {
    if (confirm(`Are you sure you want to remove '${v.name}'?`)) {
      RescueVariantManager.removeVariant(v.name);
      console.log(`Removed ${v.name} from custom foods.`);
    }
  }
  function setDefault(v: RescueVariant) {
    RescueVariantManager.setDefault(v.name);
  }

  return (
    <>
      <div className="container">
        <h1>Rescue Variants</h1>
        <Card>
          <Form onSubmit={handleFormSubmit}>
            <div className="d-flex align-items-center gap-2">
              <Form.Group controlId="food-amount" className="mb-0 flex-grow-1">
                Name:{" "}
                <Form.Control
                  type="text"
                  placeholder="e.g. tabs, grams, shots"
                  className="text-center"
                  value={name}
                  onInput={(e: BaseSyntheticEvent) => {
                    setName(e.target.value);
                  }}
                />
                <br />
                Duration (minutes):
                <Form.Control
                  type="number"
                  placeholder={`0`}
                  className="text-center"
                  value={duration || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    const value = parseFloat(e.target.value) || 0;
                    setDuration(value);
                  }}
                />
                <br />
                Effect (mg/dL per unit):
                <Form.Control
                  type="number"
                  placeholder={`0`}
                  className="text-center"
                  value={effect || ""}
                  onInput={(e: BaseSyntheticEvent) => {
                    const value = parseFloat(e.target.value) || 0;
                    setEffect(value);
                  }}
                />
                <br />
                <br />
                <div className="d-flex justify-content-end">
                  <Button
                    variant={isValid ? "primary" : "outline-primary"}
                    onClick={add}
                    disabled={!isValid}
                  >
                    Add
                  </Button>
                </div>
              </Form.Group>
            </div>
          </Form>
        </Card>
        <Card>
          <ListGroup className="mt-3">
            {variants.map((v, i) => (
              <ListGroup.Item
                key={i}
                className="d-flex justify-content-between align-items-center py-2"
              >
                <span className="fw-semibold me-4">{v.name}</span>

                <div className="d-flex align-items-center flex-wrap gap-3">
                  {/* Duration */}
                  <label className="m-0 d-flex align-items-center gap-1 small">
                    <span className="text-muted">Duration</span>
                    <Form.Control
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={v.duration || ""}
                      aria-label="Duration"
                      className="form-control-sm w-auto border-0 border-bottom rounded-0 shadow-none px-1 text-center"
                      style={{ maxWidth: "40px" }}
                      onChange={(e) => {
                        const val =
                          e.target.value === ""
                            ? undefined
                            : parseFloat(e.target.value);
                        v.duration = Number.isFinite(val as number)
                          ? (val as number)
                          : 0;
                        RescueVariantManager.updateVariant(v);
                      }}
                    />
                    <span className="text-muted">min</span>
                  </label>

                  {/* Effect */}
                  <label className="m-0 d-flex align-items-center gap-1 small">
                    <span className="text-muted">Effect</span>
                    <Form.Control
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={v.effect || ""}
                      aria-label="Effect"
                      style={{ maxWidth: "40px" }}
                      className="form-control-sm w-auto border-0 border-bottom rounded-0 shadow-none px-1 text-center"
                      onChange={(e) => {
                        const val =
                          e.target.value === ""
                            ? undefined
                            : parseFloat(e.target.value);
                        v.effect = Number.isFinite(val as number)
                          ? (val as number)
                          : 0;
                        RescueVariantManager.updateVariant(v);
                      }}
                    />
                    <span className="text-muted">mg/dL per unit</span>
                  </label>
                  <div className="w-100 d-flex justify-content-end mt-2">
                    {i !== 0 && (
                      <Button
                        size="sm"
                        variant="outline-dark"
                        onClick={() => setDefault(v)}
                        className="me-2"
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => removeVariant(v)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card>
      </div>
    </>
  );
}

import { Button, Form, ListGroup } from "react-bootstrap";
import Card from "../components/Card";
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import { RescueVariantStore } from "../storage/rescueVariantStore";
import { RescueVariantManager } from "../managers/rescueVariantManager";
import type { RescueVariant } from "../models/types/rescueVariant";
import { EmptyState, PageHeader, PageLayout } from "../components/PageLayout";

export default function RescueVariantsPage() {
  const [variants] = RescueVariantStore.variants.useState();

  const [name, setName] = useState("");
  const [carbs, setCarbs] = useState(0);
  const [effect, setEffect] = useState(0);
  const [duration, setDuration] = useState(0);

  const isValid = useMemo(
    () => name.length > 0 && duration && effect,
    [name, duration, effect],
  );

  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault();
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
    if (!carbs) {
      alert("Enter a valid carbs value");
      return;
    }
    RescueVariantManager.createVariant(name, duration, carbs, effect);
    resetUIStates();
  }

  function removeVariant(v: RescueVariant) {
    if (confirm(`Are you sure you want to remove '${v.name}'?`)) {
      RescueVariantManager.removeVariant(v.name);
    }
  }

  function setDefault(v: RescueVariant) {
    RescueVariantManager.setDefault(v.name);
  }

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Customization"
        title="Rescue variants"
        subtitle="Keep rescue options editable, but present them as calmer stacked cards for phone use."
      />

      <Card>
        <Form onSubmit={handleFormSubmit}>
          <Form.Group controlId="rescue-variant-name" className="mb-0">
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. tabs, grams, shots"
              value={name}
              onInput={(e: BaseSyntheticEvent) => {
                setName(e.target.value);
              }}
            />

            <Form.Label className="mt-3">Duration (minutes)</Form.Label>
            <Form.Control
              type="number"
              placeholder="0"
              value={duration || ""}
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setDuration(value);
              }}
            />

            <Form.Label className="mt-3">Carbs (g per unit)</Form.Label>
            <Form.Control
              type="number"
              placeholder="0"
              value={carbs || ""}
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setCarbs(value);
              }}
            />

            <Form.Label className="mt-3">Effect (mg/dL per unit)</Form.Label>
            <Form.Control
              type="number"
              placeholder="0"
              value={effect || ""}
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setEffect(value);
              }}
            />

            <div className="d-grid mt-3">
              <Button
                variant={isValid ? "primary" : "outline-primary"}
                onClick={add}
                disabled={!isValid}
              >
                Add
              </Button>
            </div>
          </Form.Group>
        </Form>
      </Card>

      <Card>
        {variants.length === 0 && (
          <EmptyState>No rescue variants saved yet.</EmptyState>
        )}
        <ListGroup className="mt-3" variant="flush">
          {variants.map((v, i) => (
            <ListGroup.Item key={i} className="d-flex flex-column gap-3 py-3">
              <div className="fw-semibold">{v.name}</div>

              <div className="d-flex align-items-center flex-wrap gap-3">
                <label className="m-0 d-flex align-items-center gap-1 small">
                  <span className="text-muted">Duration</span>
                  <Form.Control
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={v.duration || ""}
                    aria-label="Duration"
                    className="form-control-sm w-auto border-0 border-bottom rounded-0 shadow-none px-1 text-center"
                    style={{ maxWidth: "4rem" }}
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

                <label className="m-0 d-flex align-items-center gap-1 small">
                  <span className="text-muted">Carbs</span>
                  <Form.Control
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={v.carbs || ""}
                    aria-label="Carbs"
                    style={{ maxWidth: "4rem" }}
                    className="form-control-sm w-auto border-0 border-bottom rounded-0 shadow-none px-1 text-center"
                    onChange={(e) => {
                      const val =
                        e.target.value === ""
                          ? undefined
                          : parseFloat(e.target.value);
                      v.carbs = Number.isFinite(val as number)
                        ? (val as number)
                        : 0;
                      RescueVariantManager.updateVariant(v);
                    }}
                  />
                  <span className="text-muted">g per unit</span>
                </label>

                <label className="m-0 d-flex align-items-center gap-1 small">
                  <span className="text-muted">Effect</span>
                  <Form.Control
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={v.effect || ""}
                    aria-label="Effect"
                    style={{ maxWidth: "4rem" }}
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

                <div className="w-100 d-flex justify-content-end gap-2 mt-2">
                  {i !== 0 && (
                    <Button
                      size="sm"
                      variant="outline-dark"
                      onClick={() => setDefault(v)}
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
    </PageLayout>
  );
}

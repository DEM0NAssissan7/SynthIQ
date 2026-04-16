import { Button, Form, ListGroup } from "react-bootstrap";
import Card from "../components/Card";
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import { InsulinVariantStore } from "../storage/insulinVariantStore";
import { InsulinVariant } from "../models/types/insulinVariant";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import InsulinVariantDropdown from "../components/InsulinVariantDropdown";
import { Bateman } from "../lib/bateman";
import { round } from "../lib/util";
import { EmptyState, PageHeader, PageLayout } from "../components/PageLayout";

export default function InsulinVariantsPage() {
  const [variants] = InsulinVariantStore.variants.useState();

  const [basalVariantName, setBasalVariantName] =
    InsulinVariantStore.basalVariant.useState();
  const basalVariant = useMemo(
    () => InsulinVariantManager.getVariant(basalVariantName),
    [basalVariantName],
  );

  function setBasalVariant(v: InsulinVariant | undefined) {
    if (v) setBasalVariantName(v.name);
  }

  const [name, setName] = useState("");
  const [effect, setEffect] = useState(0);
  const [ka, setKa] = useState(0);
  const [ke, setKe] = useState(0.7);
  const [duration, setDuration] = useState(0);
  const [daysLife, setDaysLife] = useState(0);

  useMemo(
    () =>
      setKa(
        round(Bateman.solveKa(duration, Bateman.completionConstant, ke), 2),
      ),
    [duration, ke],
  );

  const isValid = useMemo(() => name.length > 0 && effect, [name, effect]);

  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault();
  };

  function resetUIStates() {
    setName("");
    setEffect(0);
    setDuration(0);
    setKa(0);
    setKe(0.7);
    setDaysLife(0);
  }

  function add() {
    if (!name || name.trim() === "") {
      alert("Enter a valid name.");
      return;
    }
    if (!ka || !ke) {
      alert("Enter a valid ka/ke value (or duration)");
      return;
    }
    if (ka === ke) {
      alert("ka and ke cannot be the same");
      return;
    }
    if (!effect) {
      alert("Enter a valid effect");
      return;
    }
    if (!daysLife) {
      alert("Enter a valid medication life");
      return;
    }
    InsulinVariantManager.createVariant(name, effect, daysLife, ka, ke);
    resetUIStates();
  }

  function removeVariant(v: InsulinVariant) {
    if (confirm(`Are you sure you want to remove '${v.name}'?`)) {
      InsulinVariantManager.removeVariant(v.name);
    }
  }

  function setDefault(v: InsulinVariant) {
    InsulinVariantManager.setDefault(v.name);
  }

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Customization"
        title="Insulin variants"
        subtitle="Edit insulin characteristics in a more structured mobile layout without losing the detailed tuning fields."
      />

      <Card>
        <Form onSubmit={handleFormSubmit}>
          <Form.Group controlId="insulin-variant-name" className="mb-0">
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. Novolog"
              value={name}
              onInput={(e: BaseSyntheticEvent) => {
                setName(e.target.value);
              }}
            />

            <Form.Label className="mt-3">Duration (hours)</Form.Label>
            <Form.Control
              type="number"
              placeholder="0"
              value={duration || ""}
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setDuration(value);
              }}
            />

            <Form.Label className="mt-3">
              Medication life after opened (days)
            </Form.Label>
            <Form.Control
              type="number"
              placeholder="0"
              value={daysLife || ""}
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setDaysLife(value);
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

            <Form.Label className="mt-3">Ka (absorption constant)</Form.Label>
            <Form.Control
              type="number"
              placeholder="0"
              value={ka || ""}
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setKa(value);
              }}
            />

            <Form.Label className="mt-3">Ke (elimination constant)</Form.Label>
            <Form.Control
              type="number"
              placeholder="0"
              value={ke || ""}
              onInput={(e: BaseSyntheticEvent) => {
                const value = parseFloat(e.target.value) || 0;
                setKe(value);
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
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Basal variant
        </div>
        <InsulinVariantDropdown
          variant={basalVariant}
          setVariant={setBasalVariant}
          warnBasal={false}
        />
      </Card>

      <Card>
        {variants.length === 0 && (
          <EmptyState>No insulin variants saved yet.</EmptyState>
        )}
        <ListGroup className="mt-3" variant="flush">
          {variants.map((v, i) => (
            <ListGroup.Item key={i} className="d-flex flex-column gap-3 py-3">
              <div className="fw-semibold">{v.name}</div>

              <div className="d-flex align-items-center flex-wrap gap-3">
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
                      InsulinVariantManager.updateVariant(v);
                    }}
                  />
                  <span className="text-muted">mg/dL per U</span>
                </label>

                <label className="m-0 d-flex align-items-center gap-1 small">
                  <span className="text-muted">Life</span>
                  <Form.Control
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={v.daysLife || ""}
                    aria-label="days"
                    style={{ maxWidth: "4rem" }}
                    className="form-control-sm w-auto border-0 border-bottom rounded-0 shadow-none px-1 text-center"
                    onChange={(e) => {
                      const val =
                        e.target.value === ""
                          ? undefined
                          : parseFloat(e.target.value);
                      v.daysLife = Number.isFinite(val as number)
                        ? (val as number)
                        : 0;
                      InsulinVariantManager.updateVariant(v);
                    }}
                  />
                  <span className="text-muted">days</span>
                </label>

                <label className="m-0 d-flex align-items-center gap-1 small">
                  <span className="text-muted">Ka</span>
                  <Form.Control
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={v.ka || ""}
                    aria-label="ka"
                    style={{ maxWidth: "4.5rem" }}
                    className="form-control-sm w-auto border-0 border-bottom rounded-0 shadow-none px-1 text-center"
                    onChange={(e) => {
                      const val =
                        e.target.value === ""
                          ? undefined
                          : parseFloat(e.target.value);
                      v.ka = Number.isFinite(val as number)
                        ? (val as number)
                        : 0;
                      InsulinVariantManager.updateVariant(v);
                    }}
                  />
                </label>

                <label className="m-0 d-flex align-items-center gap-1 small">
                  <span className="text-muted">Ke</span>
                  <Form.Control
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={v.ke || ""}
                    aria-label="ke"
                    style={{ maxWidth: "4.5rem" }}
                    className="form-control-sm w-auto border-0 border-bottom rounded-0 shadow-none px-1 text-center"
                    onChange={(e) => {
                      const val =
                        e.target.value === ""
                          ? undefined
                          : parseFloat(e.target.value);
                      v.ke = Number.isFinite(val as number)
                        ? (val as number)
                        : 0;
                      InsulinVariantManager.updateVariant(v);
                    }}
                  />
                </label>

                <div className="w-100 small text-muted">
                  Lasts approximately <b>{v.duration.toFixed(1)} hours</b>
                </div>

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

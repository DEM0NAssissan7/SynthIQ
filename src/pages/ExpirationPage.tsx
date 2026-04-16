import { Button, Form, ListGroup } from "react-bootstrap";
import Card from "../components/Card";
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import { InsulinVariant } from "../models/types/insulinVariant";
import { ExpirationStore } from "../storage/expirationStore";
import { InsulinExpirationManager } from "../managers/expirationManager";
import { InsulinExpiration } from "../models/insulinExpiration";
import InsulinVariantDropdown from "../components/InsulinVariantDropdown";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { EmptyState, PageHeader, PageLayout } from "../components/PageLayout";

export default function ExpirationPage() {
  const [expirations] = ExpirationStore.expirations.useState();
  const defaultVariant = InsulinVariantManager.getDefault();

  const [label, setLabel] = useState("");
  const [variant, setVariant] = useState<InsulinVariant>(defaultVariant);

  const isValid = useMemo(() => label.length > 0 && variant, [label, variant]);

  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior
  };

  function resetUIStates() {
    setLabel("");
    setVariant(defaultVariant);
  }
  function add() {
    if (!label || label.trim() === "") {
      alert("Enter a valid label.");
      return;
    }
    if (!variant) {
      alert("Choose a variant");
      return;
    }
    InsulinExpirationManager.add(label, variant, new Date());
    resetUIStates();
  }
  function remove(e: InsulinExpiration) {
    if (confirm(`Are you sure you want to remove '${e.fullName}'?`)) {
      InsulinExpirationManager.remove(e.fullName);
    }
  }
  function renew(e: InsulinExpiration) {
    if (confirm(`Confirm that you've renewed your '${e.fullName}'`)) {
      InsulinExpirationManager.renew(e);
    }
  }

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Utility"
        title="Insulin expirations"
        subtitle="Track opened insulin cleanly so replacement reminders stay visible without clutter."
      />
        <Card>
          <Form onSubmit={handleFormSubmit}>
            <Form.Group controlId="food-amount" className="mb-0">
              <Form.Label>Label</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g. Fridge"
                  value={label}
                  onInput={(e: BaseSyntheticEvent) => {
                    setLabel(`${e.target.value}`);
                  }}
                />
                <div className="mt-3">
                  <Form.Label>Variant</Form.Label>
                </div>
                <ListGroup>
                  <InsulinVariantDropdown
                    variant={variant}
                    setVariant={setVariant}
                    warnBasal={false}
                  />
                </ListGroup>
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
          {expirations.length === 0 && (
            <EmptyState>No tracked insulin expirations yet.</EmptyState>
          )}
          <ListGroup className="mt-3" variant="flush">
            {expirations.map((e, i) => (
              <ListGroup.Item
                key={i}
                className="d-flex justify-content-between align-items-start gap-3 py-3"
              >
                <div>
                  <div className="fw-semibold">{e.fullName}</div>
                  <div className="small text-muted">
                    {e.daysSinceOpened.toFixed()} days since opened
                  </div>
                </div>

                <div className="d-flex align-items-center flex-wrap justify-content-end gap-3">
                  {e.daysLeft > 0 ? (
                    <label className="m-0 d-flex align-items-center gap-1 small">
                      {e.daysLeft.toFixed()}
                      <span className="text-muted">days left</span>
                    </label>
                  ) : (
                    <label className="m-0 d-flex align-items-center gap-1 small">
                      <span className="badge bg-warning text-dark fw-semibold">
                        Expired
                      </span>
                      <span className="text-muted">
                        {(-e.daysLeft).toFixed()} days
                      </span>
                    </label>
                  )}

                  <div className="w-100 d-flex justify-content-end mt-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => renew(e)}
                    >
                      Renew
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => remove(e)}
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

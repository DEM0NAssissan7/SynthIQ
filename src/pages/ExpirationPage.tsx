import { Button, Form, ListGroup } from "react-bootstrap";
import Card from "../components/Card";
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import { InsulinVariant } from "../models/types/insulinVariant";
import { ExpirationStore } from "../storage/expirationStore";
import { InsulinExpirationManager } from "../managers/expirationManager";
import { InsulinExpiration } from "../models/insulinExpiration";
import InsulinVariantDropdown from "../components/InsulinVariantDropdown";
import { InsulinVariantManager } from "../managers/insulinVariantManager";

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
    <>
      <div className="container">
        <h1>Insulin Expirations</h1>
        <Card>
          <Form onSubmit={handleFormSubmit}>
            <div className="d-flex align-items-center gap-2">
              <Form.Group controlId="food-amount" className="mb-0 flex-grow-1">
                Label{" "}
                <Form.Control
                  type="text"
                  placeholder="e.g. Novolog"
                  className="text-center"
                  value={label}
                  onInput={(e: BaseSyntheticEvent) => {
                    setLabel(`${e.target.value}`);
                  }}
                />
                {variant?.name || ""}
                <br />
                <ListGroup>
                  <InsulinVariantDropdown
                    variant={variant}
                    setVariant={setVariant}
                    warnBasal={false}
                  />
                </ListGroup>
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
            {expirations.map((e, i) => (
              <ListGroup.Item
                key={i}
                className="d-flex justify-content-between align-items-center py-2"
              >
                <span className="fw-semibold me-4">{e.fullName}</span>

                <div className="d-flex align-items-center flex-wrap gap-3">
                  {/* Life */}
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

                  <label className="m-0 d-flex align-items-center gap-1 small">
                    {e.daysSinceOpened.toFixed()}
                    <span className="text-muted">days since opened</span>
                  </label>

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
      </div>
    </>
  );
}

import { useMemo } from "react";
import {
  Badge,
  ButtonGroup,
  Dropdown,
  Form,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import type { InsulinVariant } from "../models/types/insulinVariant";
import { InsulinVariantStore } from "../storage/insulinVariantStore";

interface InsulinVariantDropdownArgs {
  variant: InsulinVariant;
  setVariant: (v: InsulinVariant) => void;
  warnBasal?: boolean;
  id?: string;
  label?: string;
}

export default function InsulinVariantDropdown({
  variant,
  setVariant,
  warnBasal = true,
  id = "insulin-variant",
  label = "Variant",
}: InsulinVariantDropdownArgs) {
  const [variants] = InsulinVariantStore.variants.useState();

  const selectedName = variant?.name ?? "";
  const selectedIsBasal = selectedName
    ? InsulinVariantManager.isBasal(selectedName)
    : false;

  const items = useMemo(
    () =>
      variants.map((v) => {
        const isBasal = InsulinVariantManager.isBasal(v.name);
        return { v, isBasal };
      }),
    [variants]
  );

  const selectedLabel = selectedName || "Select insulin…";

  return (
    <Form.Group className="mb-2" controlId={id}>
      <Form.Label className="d-flex align-items-center gap-2">
        {label}
        {warnBasal && selectedIsBasal && (
          <OverlayTrigger
            placement="right"
            overlay={
              <Tooltip id={`${id}-basal-tip`}>
                This is a basal insulin (long-acting).
              </Tooltip>
            }
          >
            <span role="img" aria-label="Basal insulin warning">
              ⚠️
            </span>
          </OverlayTrigger>
        )}
      </Form.Label>

      <Dropdown as={ButtonGroup}>
        <Dropdown.Toggle
          id={`${id}-toggle`}
          variant="outline-secondary"
          className="d-flex align-items-center justify-content-between gap-2"
          style={{ minWidth: 260 }}
          aria-label={`${label}: ${selectedLabel}`}
        >
          <span className="text-truncate">{selectedLabel}</span>

          {selectedIsBasal && (
            <Badge bg="warning" text="dark">
              Basal
            </Badge>
          )}
        </Dropdown.Toggle>

        <Dropdown.Menu style={{ minWidth: 320 }}>
          <Dropdown.Header>Choose a variant</Dropdown.Header>

          {items.map(({ v, isBasal }) => (
            <Dropdown.Item
              key={v.name}
              active={v.name === selectedName}
              onClick={() => setVariant(v)}
              className="d-flex align-items-center justify-content-between gap-3"
            >
              <span className="text-truncate">{v.name}</span>

              {isBasal ? (
                <Badge bg="warning" text="dark">
                  Basal
                </Badge>
              ) : (
                <span className="text-muted small">Rapid</span>
              )}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>

      {warnBasal && selectedIsBasal && (
        <>
          <br />
          <Form.Text className="text-warning">
            Basal insulin selected. Double-check selection.
          </Form.Text>
        </>
      )}
    </Form.Group>
  );
}

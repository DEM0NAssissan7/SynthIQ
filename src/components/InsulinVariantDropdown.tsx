import { Form } from "react-bootstrap";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import type { InsulinVariant } from "../models/types/insulinVariant";
import { InsulinVariantStore } from "../storage/insulinVariantStore";

interface InsulinVariantDropdownArgs {
  variant: InsulinVariant;
  setVariant: (v: InsulinVariant) => void;
}
export default function InsulinVariantDropdown({
  variant,
  setVariant,
}: InsulinVariantDropdownArgs) {
  const [variants] = InsulinVariantStore.variants.useState();
  return (
    <Form.Select
      onChange={(e) => {
        // You can handle insulin type selection here if needed
        const v = InsulinVariantManager.getVariant(e.target.value);
        if (v) setVariant(v);
      }}
      value={variant?.name || ""}
      className="mb-2"
    >
      {variants.map((v) => (
        <option value={v.name}>{v.name}</option>
      ))}
    </Form.Select>
  );
}

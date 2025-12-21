import { Form } from "react-bootstrap";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import type { InsulinVariant } from "../models/types/insulinVariant";
import { InsulinVariantStore } from "../storage/insulinVariantStore";

interface InsulinVariantDropdownArgs {
  variant: InsulinVariant | undefined;
  setVariant: (v: InsulinVariant | undefined) => void;
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
        else setVariant(undefined);
      }}
      value={variant?.name || ""}
      className="mb-2"
    >
      {/* Blank option */}
      <option value={""}></option>
      {variants.map((v) => (
        <option value={v.name}>{v.name}</option>
      ))}
    </Form.Select>
  );
}

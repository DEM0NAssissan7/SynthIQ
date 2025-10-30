import React from "react";
import { Button } from "react-bootstrap"; // assuming react-bootstrap, adjust if different

type NumberOptionSelectorProps = {
  value: number; // the base value (origin)
  rangeFromOrigin: number; // how many steps out in both directions
  increment?: number; // step size (default 0.5)
  labelSuffix?: string; // e.g. "u", "mg", "%"
  onSelect: (val: number) => void; // callback when selected
  highlightOriginal?: boolean;
};

export const NumberOptionSelector: React.FC<NumberOptionSelectorProps> = ({
  value,
  rangeFromOrigin,
  increment = 0.5,
  labelSuffix = "",
  onSelect,
  highlightOriginal = true,
}) => {
  const baseValue =
    Math.max(value - rangeFromOrigin * increment, 0) +
    rangeFromOrigin * increment;

  const options: number[] = [];
  for (let i = -rangeFromOrigin; i <= rangeFromOrigin; i++) {
    const n = baseValue + i * increment;
    if (!Number.isNaN(n)) options.push(n);
  }

  return (
    <>
      {options.map((opt) => (
        <Button
          key={opt}
          variant={
            opt !== value || !highlightOriginal
              ? "outline-secondary"
              : "outline-primary"
          }
          className="me-2 mb-2"
          onClick={() => onSelect(opt)}
        >
          {opt}
          {labelSuffix}
        </Button>
      ))}
    </>
  );
};

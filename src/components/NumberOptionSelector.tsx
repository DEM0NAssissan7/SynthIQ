import React from "react";

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
    Math.max(value - rangeFromOrigin * increment, increment) +
    rangeFromOrigin * increment;

  const options: number[] = [];
  for (let i = -rangeFromOrigin; i <= rangeFromOrigin; i++) {
    const n = baseValue + i * increment;
    if (!Number.isNaN(n)) options.push(n);
  }

  return (
    <div className="app-number-options-row">
      {options.map((opt) => {
        const isSelected = opt === value && highlightOriginal;
        return (
          <button
            key={opt}
            type="button"
            className={`app-number-option-btn ${isSelected ? "is-selected" : ""}`}
            onClick={() => onSelect(opt)}
          >
            {opt}
            {labelSuffix}
          </button>
        );
      })}
    </div>
  );
};

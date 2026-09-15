import type { ReactNode } from "react";
import MdIcon from "./MdIcon";

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  icon?: string | ReactNode;
}

interface MdSegmentedButtonProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

export default function MdSegmentedButton<T extends string | number>({
  options,
  value,
  onChange,
  className = "",
}: MdSegmentedButtonProps<T>) {
  return (
    <div className={`md3-segmented-button ${className}`.trim()} role="group">
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            className={`md3-segment-btn ${isActive ? "active" : ""}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={isActive}
          >
            {typeof opt.icon === "string" ? (
              opt.icon.startsWith("bi-") ? (
                <i className={`bi ${opt.icon}`} />
              ) : (
                <MdIcon name={opt.icon} size={18} />
              )
            ) : (
              opt.icon
            )}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

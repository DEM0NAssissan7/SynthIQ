import type { HTMLAttributes, ReactNode } from "react";
import MdIcon from "./MdIcon";

interface MdChipProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  icon?: string | ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  badge?: ReactNode;
}

export default function MdChip({
  label,
  icon,
  selected = false,
  onClick,
  className = "",
  badge,
  ...props
}: MdChipProps) {
  const clickableClass = onClick ? "is-clickable" : "";
  const selectedClass = selected ? "is-selected" : "";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`md3-chip ${clickableClass} ${selectedClass} ${className}`.trim()}
      {...props}
    >
      {typeof icon === "string" ? (
        icon.startsWith("bi-") ? (
          <i className={`bi ${icon}`} />
        ) : (
          <MdIcon name={icon} size={18} />
        )
      ) : (
        icon
      )}
      <span>{label}</span>
      {badge && <span className="ms-1 opacity-75">{badge}</span>}
    </div>
  );
}

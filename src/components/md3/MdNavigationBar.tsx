import type { ReactNode } from "react";
import MdIcon from "./MdIcon";

export interface MdNavigationItemProps {
  label: string;
  icon: string;
  activeIcon?: string;
  isActive: boolean;
  onClick: () => void;
  badge?: boolean | ReactNode;
  badgeClass?: string;
  ariaLabel?: string;
}

export function MdNavigationItem({
  label,
  icon,
  activeIcon,
  isActive,
  onClick,
  badge,
  badgeClass = "",
  ariaLabel,
}: MdNavigationItemProps) {
  const displayIcon = isActive && activeIcon ? activeIcon : icon;
  const isMaterialSymbol = !displayIcon.startsWith("bi-");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`app-bottom-nav-item ${isActive ? "active" : ""}`}
      aria-label={ariaLabel || label}
      aria-current={isActive ? "page" : undefined}
    >
      <div className="app-bottom-nav-indicator">
        {isMaterialSymbol ? (
          <MdIcon name={displayIcon} fill={isActive} size={24} />
        ) : (
          <i className={`bi ${displayIcon}`} />
        )}
        {badge === true && <span className={`app-bottom-nav-dot ${badgeClass}`} />}
        {typeof badge === "string" || typeof badge === "number" ? (
          <span className="app-bottom-nav-badge-pill">
            {badge}
          </span>
        ) : null}
      </div>
      <span className="app-bottom-nav-label">{label}</span>
    </button>
  );
}

interface MdNavigationBarProps {
  children: ReactNode;
  ariaLabel?: string;
  onPullClick?: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLElement>) => void;
  onClickCapture?: (e: React.MouseEvent<HTMLElement>) => void;
}

export default function MdNavigationBar({
  children,
  ariaLabel = "Primary Navigation",
  onPullClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClickCapture,
}: MdNavigationBarProps) {
  return (
    <nav
      className="app-bottom-nav"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onClickCapture}
    >
      <div
        className="app-bottom-nav-drag-handle-wrap"
        role="button"
        tabIndex={0}
        aria-label="Drag up for More menu"
        onClick={onPullClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPullClick?.();
          }
        }}
      >
        <div className="app-bottom-nav-drag-handle" />
      </div>
      <div className="app-bottom-nav-inner">{children}</div>
    </nav>
  );
}

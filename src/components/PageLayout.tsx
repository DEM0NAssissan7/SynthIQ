import type { ReactNode } from "react";
import { Button, Card, Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router";

interface PageLayoutProps {
  children: ReactNode;
  maxWidth?: string;
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}

export function PageLayout({ children, maxWidth = "36rem" }: PageLayoutProps) {
  return (
    <Container fluid="sm" className="app-page px-0 pb-4">
      <div className="mx-auto" style={{ maxWidth }}>
        {children}
      </div>
    </Container>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  showBack,
  onBack,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isMainTab =
    location.pathname === "/" ||
    location.pathname === "/hub" ||
    location.pathname === "/insulin" ||
    location.pathname === "/rescue" ||
    location.pathname === "/meal";

  const shouldShowBack = showBack !== undefined ? showBack : !isMainTab;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/hub");
    }
  };

  return (
    <header className="app-header">
      {eyebrow && <div className="app-kicker">{eyebrow}</div>}
      <div className="d-flex flex-column gap-3">
        <div className="d-flex align-items-center gap-2">
          {shouldShowBack && (
            <button
              type="button"
              className="md3-back-btn flex-shrink-0"
              onClick={handleBack}
              aria-label="Go back"
            >
              <span className="material-symbols-rounded">arrow_back</span>
            </button>
          )}
          <div className="flex-grow-1">
            <h1 className="app-title mb-0">{title}</h1>
            {subtitle && <p className="app-subtitle mb-0 mt-1">{subtitle}</p>}
          </div>
        </div>
        {actions && <div>{actions}</div>}
      </div>
    </header>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="app-metric-grid">{children}</div>;
}

interface MetricPillProps {
  label: string;
  value: ReactNode;
}

export function MetricPill({ label, value }: MetricPillProps) {
  return (
    <div className="app-metric-pill">
      <div className="app-metric-label">{label}</div>
      <div className="app-metric-value">{value}</div>
    </div>
  );
}

export function PageActions({
  children,
  inline = false,
}: {
  children: ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={`app-actions ${inline ? "app-actions-inline" : ""}`.trim()}>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="app-empty-state">{children}</div>;
}

export function ActionGrid({ children }: { children: ReactNode }) {
  return <div className="app-action-grid">{children}</div>;
}

interface ActionCardProps {
  icon: string;
  title: string;
  body: ReactNode;
  buttonLabel: string;
  buttonVariant?: string;
  eyebrow?: string;
  to?: string;
  onClick?: () => void;
  className?: string;
}

export function ActionCard({
  icon,
  title,
  body,
  buttonLabel,
  buttonVariant = "primary",
  eyebrow,
  to,
  onClick,
  className = "",
}: ActionCardProps) {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    }
  };

  return (
    <Card
      data-eyebrow={eyebrow}
      className={`h-100 border-0 shadow-sm app-action-card ${className}`.trim()}
    >
      <Card.Body className="p-3 d-flex flex-column">
        <div className="d-flex align-items-start gap-3 flex-grow-1">
          <div className="app-action-icon">
            {icon.startsWith("bi-") ? (
              <i className={`bi ${icon} fs-4`} />
            ) : (
              <span className="material-symbols-rounded" style={{ fontSize: "28px" }}>
                {icon}
              </span>
            )}
          </div>
          <div className="flex-grow-1">
            {eyebrow && <div className="app-kicker mb-1">{eyebrow}</div>}
            <h2 className="h5 mb-1">{title}</h2>
            <p className="text-muted mb-0">{body}</p>
          </div>
        </div>
        <Button
          variant={buttonVariant}
          className="w-100 mt-3 py-2 fw-semibold"
          onClick={handleAction}
        >
          {buttonLabel}
        </Button>
      </Card.Body>
    </Card>
  );
}

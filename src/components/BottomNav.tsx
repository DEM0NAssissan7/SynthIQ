import { useLocation, useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { basalIsDue } from "../lib/healthMonitor";
import { useNow } from "../state/useNow";
import { WizardStore } from "../storage/wizardStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const now = useNow(60);

  const [meal] = WizardStore.meal.useState();
  const [boluses] = HealthMonitorStore.recentBoluses.useState();

  const [dueForBasal, setDueForBasal] = useState(() => basalIsDue());
  useMemo(() => {
    setDueForBasal(basalIsDue());
  }, [now]);

  const hasActiveBolus = useMemo(() => {
    return boluses.some((b) => b.isActive);
  }, [boluses]);

  const isStatusActive =
    location.pathname === "/" || location.pathname === "/hub";
  const isInsulinActive =
    location.pathname === "/insulin" ||
    location.pathname === "/markinsulin" ||
    location.pathname === "/prebolus";
  const isRescueActive =
    location.pathname === "/rescue" || location.pathname === "/rescuevariants";
  const isMealActive =
    location.pathname === "/meal" || location.pathname === "/selectmeal";

  const handleStatusClick = () => {
    navigate("/hub");
  };

  const handleInsulinClick = () => {
    WizardStore.isPrebolus.value = false;
    navigate("/insulin");
  };

  const handleRescueClick = () => {
    navigate("/rescue");
  };

  const handleMealClick = () => {
    if (meal.isEmpty) {
      navigate("/selectmeal");
    } else {
      navigate("/meal");
    }
  };

  return (
    <nav className="app-bottom-nav" aria-label="Primary Navigation">
      <div className="app-bottom-nav-inner">
        {/* Status Tab */}
        <button
          type="button"
          onClick={handleStatusClick}
          className={`app-bottom-nav-item ${isStatusActive ? "active" : ""}`}
          aria-label="Status Hub"
        >
          <div className="app-bottom-nav-icon-wrap">
            <i
              className={`bi ${isStatusActive ? "bi-heart-pulse-fill" : "bi-heart-pulse"}`}
            />
            {dueForBasal && <span className="app-bottom-nav-dot" />}
          </div>
          <span className="app-bottom-nav-label">Status</span>
        </button>

        {/* Insulin Tab */}
        <button
          type="button"
          onClick={handleInsulinClick}
          className={`app-bottom-nav-item ${isInsulinActive ? "active" : ""}`}
          aria-label="Insulin Dosing"
        >
          <div className="app-bottom-nav-icon-wrap">
            <i
              className={`bi ${isInsulinActive ? "bi-droplet-fill" : "bi-droplet"}`}
            />
            {hasActiveBolus && (
              <span className="app-bottom-nav-dot active-dot" />
            )}
          </div>
          <span className="app-bottom-nav-label">Insulin</span>
        </button>

        {/* Rescue Tab */}
        <button
          type="button"
          onClick={handleRescueClick}
          className={`app-bottom-nav-item ${isRescueActive ? "active" : ""}`}
          aria-label="Rescue Glucose"
        >
          <div className="app-bottom-nav-icon-wrap">
            <i
              className={`bi ${isRescueActive ? "bi-life-preserver" : "bi-life-preserver"}`}
            />
          </div>
          <span className="app-bottom-nav-label">Rescue</span>
        </button>

        {/* Meal Tab */}
        <button
          type="button"
          onClick={handleMealClick}
          className={`app-bottom-nav-item ${isMealActive ? "active" : ""}`}
          aria-label="Meal Wizard"
        >
          <div className="app-bottom-nav-icon-wrap">
            <i
              className={`bi ${isMealActive ? "bi-cup-hot-fill" : "bi-cup-hot"}`}
            />
            {!meal.isEmpty && <span className="app-bottom-nav-dot meal-dot" />}
          </div>
          <span className="app-bottom-nav-label">Meal</span>
        </button>
      </div>
    </nav>
  );
}

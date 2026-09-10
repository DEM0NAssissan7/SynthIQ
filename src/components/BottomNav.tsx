import { useLocation, useNavigate } from "react-router";
import { useMemo, useRef, useState } from "react";
import { basalIsDue } from "../lib/healthMonitor";
import { useNow } from "../state/useNow";
import { WizardStore } from "../storage/wizardStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PreferencesStore } from "../storage/preferencesStore";
import type { ThemeMode } from "../lib/themeManager";
import { checkPwaUpdate } from "../lib/pwaUpdater";
import { VERSION_STRING } from "../version";
import { getIsDynamicColorActive } from "../lib/dynamicTheme";
import logo from "../assets/logo.png";
import MdNavigationBar, { MdNavigationItem } from "./md3/MdNavigationBar";
import MdModalBottomSheet from "./md3/MdModalBottomSheet";
import MdSegmentedButton from "./md3/MdSegmentedButton";
import MdChip from "./md3/MdChip";

interface ToolItem {
  label: string;
  to: string;
  icon: string;
  desc?: string;
  badge?: string;
}

interface ToolGroup {
  title: string;
  items: ToolItem[];
}

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const now = useNow(60);

  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [dragUpY, setDragUpY] = useState<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const hasDraggedRef = useRef(false);

  const handleBarPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    hasDraggedRef.current = false;
  };

  const handleBarPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!pointerStartRef.current) return;
    const dy = pointerStartRef.current.y - e.clientY;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);

    // If upward movement is prominent and greater than 8px, start dragging the drawer up
    if (dy > 8 && dy > dx) {
      if (!hasDraggedRef.current) {
        hasDraggedRef.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      setDragUpY(dy);
    }
  };

  const handleBarPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!pointerStartRef.current) return;
    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    if (hasDraggedRef.current) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      const dy = start.y - e.clientY;
      const dt = Math.max(1, Date.now() - start.time);
      const velocity = dy / dt; // upward velocity in px/ms

      if (dy > 60 || velocity > 0.35) {
        setShowMoreSheet(true);
      }
      setDragUpY(null);
    }
  };

  const handleBarPointerCancel = (e: React.PointerEvent<HTMLElement>) => {
    if (hasDraggedRef.current) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    pointerStartRef.current = null;
    hasDraggedRef.current = false;
    setDragUpY(null);
  };

  const handleBarClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      hasDraggedRef.current = false;
    }
  };

  const [themeMode, setThemeMode] = PreferencesStore.themeMode.useState();
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

  const isDynamicActive = getIsDynamicColorActive();

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

  const handleNav = (to: string) => {
    setShowMoreSheet(false);
    navigate(to);
  };

  const toolGroups: ToolGroup[] = [
    {
      title: "Treatment & Activity",
      items: [
        {
          label: "Basal Injection",
          to: "/basal",
          icon: "bi-shield-check",
          desc: "Log daily long-acting background doses",
          badge: dueForBasal ? "Due" : undefined,
        },
        {
          label: "Physical Activity",
          to: "/activity",
          icon: "bi-person-walking",
          desc: "Track workouts & glycemic impact",
        },
      ],
    },
    {
      title: "Data & Insights",
      items: [
        {
          label: "History & Logs",
          to: "/history",
          icon: "bi-clock-history",
          desc: "Browse past meals, boluses, and sessions",
        },
        {
          label: "Statistics & Profiles",
          to: "/statistics",
          icon: "bi-graph-up-arrow",
          desc: "Carb ratios, daily totals, and ISF analysis",
        },
        {
          label: "Supply Expirations",
          to: "/expirations",
          icon: "bi-hourglass-split",
          desc: "Monitor insulin vial & sensor timelines",
        },
      ],
    },
    {
      title: "Calculators & Setup",
      items: [
        {
          label: "Dextrose Calculator",
          to: "/dextrose",
          icon: "bi-calculator",
          desc: "Quick solution & powder dosing helper",
        },
        {
          label: "Custom Foods Library",
          to: "/customfoods",
          icon: "bi-egg-fried",
          desc: "Manage personalized food macros",
        },
        {
          label: "Insulin Variants",
          to: "/insulinvariants",
          icon: "bi-capsule",
          desc: "Configure bolus & basal profiles",
        },
        {
          label: "Rescue Variants",
          to: "/rescuevariants",
          icon: "bi-bandaid",
          desc: "Configure fast-acting carbs",
        },
      ],
    },
    {
      title: "System & Settings",
      items: [
        {
          label: "Settings",
          to: "/settings",
          icon: "bi-gear-fill",
          desc: "Targets, thresholds, calibration factors",
        },
        {
          label: "Nightscout Sync",
          to: "/setup",
          icon: "bi-hdd-network-fill",
          desc: "Remote storage and token configurations",
        },
        {
          label: "Debug Console",
          to: "/debug",
          icon: "bi-terminal",
          desc: "Inspect live runtime stores & state",
        },
      ],
    },
  ];

  return (
    <>
      <MdNavigationBar
        ariaLabel="Primary Navigation"
        onPullClick={() => setShowMoreSheet(true)}
        onPointerDown={handleBarPointerDown}
        onPointerMove={handleBarPointerMove}
        onPointerUp={handleBarPointerUp}
        onPointerCancel={handleBarPointerCancel}
        onClickCapture={handleBarClickCapture}
      >
        {/* Status Tab */}
        <MdNavigationItem
          label="Status"
          icon="bi-heart-pulse"
          activeIcon="bi-heart-pulse-fill"
          isActive={isStatusActive}
          onClick={handleStatusClick}
          badge={dueForBasal}
          ariaLabel="Status Hub"
        />

        {/* Insulin Tab */}
        <MdNavigationItem
          label="Insulin"
          icon="bi-droplet"
          activeIcon="bi-droplet-fill"
          isActive={isInsulinActive}
          onClick={handleInsulinClick}
          badge={hasActiveBolus}
          badgeClass="active-dot"
          ariaLabel="Insulin Dosing"
        />

        {/* Rescue Tab */}
        <MdNavigationItem
          label="Rescue"
          icon="bi-life-preserver"
          activeIcon="bi-life-preserver"
          isActive={isRescueActive}
          onClick={handleRescueClick}
          ariaLabel="Rescue Glucose"
        />

        {/* Meal Tab */}
        <MdNavigationItem
          label="Meal"
          icon="bi-cup-hot"
          activeIcon="bi-cup-hot-fill"
          isActive={isMealActive}
          onClick={handleMealClick}
          badge={!meal.isEmpty}
          badgeClass="meal-dot"
          ariaLabel="Meal Wizard"
        />
      </MdNavigationBar>

      {/* Material 3 Bottom Drawer (More Menu) */}
      <MdModalBottomSheet
        show={showMoreSheet}
        onHide={() => setShowMoreSheet(false)}
        dragUpY={dragUpY}
        title={
          <div className="d-flex align-items-center gap-2">
            <img
              src={logo}
              alt="SynthIQ Logo"
              style={{ width: "26px", height: "26px", borderRadius: "6px" }}
            />
            <span>SynthIQ Hub</span>
          </div>
        }
      >
        {/* Dynamic Theme Badge */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <MdChip
            icon={isDynamicActive ? "bi-palette-fill" : "bi-droplet-half"}
            label={
              isDynamicActive
                ? "Material You: Phone Theme Active"
                : "Theme: Medical Blue Baseline"
            }
            className="small"
          />
        </div>

        {/* Theme Mode Segmented Button */}
        <div className="mb-4">
          <MdSegmentedButton
            value={themeMode}
            onChange={(mode) => setThemeMode(mode as ThemeMode)}
            options={[
              { value: "auto", label: "Auto", icon: "bi-circle-half" },
              { value: "light", label: "Light", icon: "bi-sun-fill" },
              { value: "dark", label: "Dark", icon: "bi-moon-fill" },
            ]}
          />
        </div>

        {/* Categorized Tool Groups */}
        {toolGroups.map((group) => (
          <div key={group.title} className="md3-sheet-section">
            <div className="md3-sheet-section-header">{group.title}</div>
            <div className="md3-sheet-list">
              {group.items.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => handleNav(item.to)}
                  className="md3-sheet-item"
                >
                  <div className="md3-sheet-icon">
                    <i className={`bi ${item.icon}`} />
                  </div>
                  <div className="md3-sheet-content">
                    <div className="md3-sheet-label">{item.label}</div>
                    {item.desc && (
                      <div className="md3-sheet-desc">{item.desc}</div>
                    )}
                  </div>
                  {item.badge && (
                    <span className="md3-sheet-badge">{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Sheet Footer with Version and Updates */}
        <div className="text-center pt-3 pb-2 border-top border-secondary-subtle mt-3">
          <button
            type="button"
            onClick={checkPwaUpdate}
            className="btn btn-link p-0 text-decoration-none small text-muted"
            title="Tap to check for updates"
          >
            SynthIQ {VERSION_STRING} · Tap to check updates
          </button>
        </div>
      </MdModalBottomSheet>
    </>
  );
}

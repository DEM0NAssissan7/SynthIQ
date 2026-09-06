import { useState, useMemo } from "react";
import { Offcanvas } from "react-bootstrap";
import { selfID } from "../lib/remote/backend";
import { Link, useLocation, useNavigate } from "react-router";
import logo from "../assets/logo.png";
import { basalIsDue } from "../lib/healthMonitor";
import { useNow } from "../state/useNow";
import { PreferencesStore } from "../storage/preferencesStore";
import type { ThemeMode } from "../lib/themeManager";
import { checkPwaUpdate } from "../lib/pwaUpdater";
import { VERSION_STRING } from "../version";

interface ToolItem {
  label: string;
  to: string;
  icon: string;
  iconBg: string;
  desc?: string;
  badge?: string;
}

interface ToolGroup {
  title: string;
  items: ToolItem[];
}

export default function TopBar() {
  const [showMenu, setShowMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const now = useNow(60);

  const [themeMode, setThemeMode] = PreferencesStore.themeMode.useState();
  const [dueForBasal, setDueForBasal] = useState(() => basalIsDue());
  useMemo(() => {
    setDueForBasal(basalIsDue());
  }, [now]);

  const showBackbutton =
    location.pathname === "/" ||
    location.pathname === "/hub" ||
    location.pathname === "/insulin" ||
    location.pathname === "/markinsulin" ||
    location.pathname === "/prebolus" ||
    location.pathname === "/rescue" ||
    location.pathname === "/meal" ||
    location.pathname === "/selectmeal";

  // Map route to title for the iOS header navigation
  const pageTitle = useMemo(() => {
    const path = location.pathname;
    if (path === "/" || path === "/hub") return "SynthIQ";
    if (path.startsWith("/insulin") || path.startsWith("/markinsulin"))
      return "Insulin Dosing";
    if (path.startsWith("/prebolus")) return "Prebolus";
    if (path.startsWith("/rescue")) return "Low Rescue";
    if (path.startsWith("/meal")) return "Meal";
    if (path.startsWith("/selectmeal")) return "Select Meal";
    if (path.startsWith("/basal")) return "Basal";
    if (path.startsWith("/activity")) return "Activity";
    if (path.startsWith("/history")) return "History";
    if (path.startsWith("/statistics")) return "Statistics";
    if (path.startsWith("/customfoods")) return "Custom Foods";
    if (path.startsWith("/insulinvariants")) return "Insulin Variants";
    if (path.startsWith("/rescuevariants")) return "Rescue Variants";
    if (path.startsWith("/dextrose")) return "Dextrose Calc";
    if (path.startsWith("/expirations")) return "Expirations";
    if (path.startsWith("/settings")) return "Settings";
    if (path.startsWith("/setup")) return "Nightscout Setup";
    if (path.startsWith("/debug")) return "Debug Logs";
    if (path.startsWith("/session/edit")) return "Edit Session";
    if (path.startsWith("/test")) return "Test Page";
    return "SynthIQ";
  }, [location.pathname]);

  const toolGroups: ToolGroup[] = [
    {
      title: "Treatment & Activity",
      items: [
        {
          label: "Basal Injection",
          to: "/basal",
          icon: "bi-shield-check",
          iconBg: "linear-gradient(135deg, #10b981, #059669)",
          desc: "Log daily long-acting background doses",
          badge: dueForBasal ? "Due" : undefined,
        },
        {
          label: "Physical Activity",
          to: "/activity",
          icon: "bi-person-walking",
          iconBg: "linear-gradient(135deg, #06b6d4, #0284c7)",
          desc: "Track workouts & glycemic impact",
        },
      ],
    },
    {
      title: "Data & Insights",
      items: [
        {
          label: "History Log",
          to: "/history",
          icon: "bi-clock-history",
          iconBg: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
          desc: "Review past boluses, meals, and sugars",
        },
        {
          label: "Statistics & Trends",
          to: "/statistics",
          icon: "bi-graph-up",
          iconBg: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
          desc: "Time in range, averages, and charts",
        },
        {
          label: "Insulin Expirations",
          to: "/expirations",
          icon: "bi-calendar-x",
          iconBg: "linear-gradient(135deg, #f43f5e, #e11d48)",
          desc: "Track open vials and pen shelf-life",
        },
      ],
    },
    {
      title: "Customization & Utilities",
      items: [
        {
          label: "Custom Foods",
          to: "/customfoods",
          icon: "bi-egg-fried",
          iconBg: "linear-gradient(135deg, #f59e0b, #d97706)",
          desc: "Create and manage custom carb presets",
        },
        {
          label: "Insulin Variants",
          to: "/insulinvariants",
          icon: "bi-droplet-half",
          iconBg: "linear-gradient(135deg, #0ea5e9, #0284c7)",
          desc: "Manage rapid, ultra-rapid & regular profiles",
        },
        {
          label: "Rescue Variants",
          to: "/rescuevariants",
          icon: "bi-life-preserver",
          iconBg: "linear-gradient(135deg, #f97316, #ea580c)",
          desc: "Configure fast carbs & response speeds",
        },
        {
          label: "Dextrose Calculator",
          to: "/dextrose",
          icon: "bi-calculator",
          iconBg: "linear-gradient(135deg, #14b8a6, #0f766e)",
          desc: "Quick glucose mass calculations",
        },
      ],
    },
    {
      title: "Settings & System",
      items: [
        {
          label: "Preferences & Ratios",
          to: "/settings",
          icon: "bi-sliders",
          iconBg: "linear-gradient(135deg, #64748b, #475569)",
          desc: "ICR, ISF, target glucose and calibration",
        },
        {
          label: "Nightscout Setup",
          to: "/setup",
          icon: "bi-cloud-check",
          iconBg: "linear-gradient(135deg, #6366f1, #4f46e5)",
          desc: "API credentials and sync connection",
        },
        {
          label: "System Debug",
          to: "/debug",
          icon: "bi-terminal",
          iconBg: "linear-gradient(135deg, #475569, #334155)",
          desc: "Diagnostics and state logs",
        },
      ],
    },
  ];

  const handleNav = (to: string) => {
    setShowMenu(false);
    navigate(to);
  };

  const handleBack = () => {
    navigate("/hub");
  };

  return (
    <>
      <header className="app-topbar-header">
        <div className="app-topbar-inner">
          {/* Left section */}
          <div className="app-topbar-left">
            {!showBackbutton ? (
              <button
                type="button"
                onClick={handleBack}
                className="app-header-back-btn"
                aria-label="Go back"
              >
                <i className="bi bi-chevron-left" />
                <span className="app-header-back-label">Back</span>
              </button>
            ) : (
              <Link to="/hub" className="app-header-brand">
                <img
                  src={logo}
                  alt="SynthIQ Logo"
                  className="app-header-logo"
                />
                <span className="app-header-title">SynthIQ</span>
              </Link>
            )}
          </div>

          {/* Center section (Title on sub-pages or status on home) */}
          <div className="app-topbar-center">
            {!showBackbutton ? (
              <span className="app-topbar-page-title">{pageTitle}</span>
            ) : (
              <div className="app-header-status-pill">
                <span className="app-status-live-dot" />
                <span className="app-status-text">{selfID}</span>
              </div>
            )}
          </div>

          {/* Right section */}
          <div className="app-topbar-right">
            {dueForBasal && !location.pathname.startsWith("/basal") && (
              <button
                type="button"
                onClick={() => navigate("/basal")}
                className="app-header-basal-pill"
                title="Basal injection due"
              >
                <i className="bi bi-shield-exclamation me-1" />
                <span>Basal Due</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowMenu(true)}
              className="app-header-menu-btn"
              aria-label="Browse features and settings"
              title="More Options"
            >
              <i className="bi bi-grid-fill" />
            </button>
          </div>
        </div>
      </header>

      {/* iOS-Style Browse & Settings Drawer */}
      <Offcanvas
        show={showMenu}
        onHide={() => setShowMenu(false)}
        placement="end"
        className="app-menu-sheet"
      >
        <Offcanvas.Header
          closeButton
          className="app-sheet-header border-0 pb-1"
        >
          <Offcanvas.Title className="app-sheet-title d-flex align-items-center gap-2">
            <img
              src={logo}
              alt="Logo"
              style={{ width: "24px", height: "24px", borderRadius: "6px" }}
            />
            <span>SynthIQ Hub</span>
          </Offcanvas.Title>
        </Offcanvas.Header>

        <Offcanvas.Body className="app-sheet-body pt-1 pb-4">
          {/* Theme Mode Segmented Control */}
          <div className="app-segmented-control mb-3">
            {(["auto", "light", "dark"] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`app-segment-btn ${themeMode === mode ? "active" : ""}`}
                onClick={() => setThemeMode(mode)}
              >
                <i
                  className={`bi ${
                    mode === "auto"
                      ? "bi-circle-half"
                      : mode === "light"
                        ? "bi-sun-fill"
                        : "bi-moon-fill"
                  } me-1`}
                />
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Menu Tool Groups */}
          <div className="d-flex flex-column gap-3">
            {toolGroups.map((group) => (
              <div key={group.title} className="app-grouped-section">
                <div className="app-grouped-header">{group.title}</div>
                <div className="app-grouped-list">
                  {group.items.map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => handleNav(item.to)}
                      className="app-grouped-item"
                    >
                      <div
                        className="app-grouped-icon"
                        style={{ background: item.iconBg }}
                      >
                        <i className={`bi ${item.icon}`} />
                      </div>
                      <div className="app-grouped-content">
                        <div className="app-grouped-label">{item.label}</div>
                        {item.desc && (
                          <div className="app-grouped-desc">{item.desc}</div>
                        )}
                      </div>
                      {item.badge && (
                        <span className="app-grouped-badge">{item.badge}</span>
                      )}
                      <i className="bi bi-chevron-right app-grouped-chevron" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sheet Footer */}
          <div className="app-sheet-footer mt-4 pt-3 text-center border-top">
            <button
              type="button"
              onClick={checkPwaUpdate}
              className="btn btn-link p-0 text-decoration-none app-version text-muted small"
              title="Tap to check for updates"
            >
              SynthIQ {VERSION_STRING} · Tap to check updates
            </button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

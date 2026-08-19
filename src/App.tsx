import { Navigate, Route, Routes } from "react-router";
import TopBar from "./components/TopBar";
import HubPage from "./pages/HubPage";
import SettingsPage from "./pages/SettingsPage";
import SetupPage from "./pages/SetupPage";
import WizardIntroPage from "./pages/wizard/WizardIntroPage";
import WizardRouterPage from "./pages/wizard/WizardRouterPage";
import { useEffect, useState } from "react";
import CustomFoodsPage from "./pages/CustomFoodsPage";
import DextrosePage from "./pages/DextrosePage";
import StatisticsPage from "./pages/StatisticsPage";

import WizardMealPage from "./pages/wizard/WizardMealPage";
import WizardSelectionPage from "./pages/wizard/WizardSelectionPage";
import WizardFinalBGPage from "./pages/wizard/WizardFinalBGPage";
import WizardEditPage from "./pages/wizard/WizardEditPage";
import RescuePage from "./pages/RescuePage";
import {
  cleanInactivePreviousBoluses,
  updateHealthMonitorStatus,
} from "./lib/healthMonitor";
import Backend from "./lib/remote/backend";
import RemoteStorage from "./lib/remote/storage";
import BasalPage from "./pages/BasalPage";
import { BackendStore } from "./storage/backendStore";
import { WizardStore } from "./storage/wizardStore";
import ActivityRouterPage from "./pages/activity/ActivityRouterPage";
import ActivitySelectPage from "./pages/activity/ActivitySelectPage";
import ActivityStartPage from "./pages/activity/ActivityStartPage";
import ActivityEndPage from "./pages/activity/ActivityEndPage";
import { ActivityStore } from "./storage/activityStore";
import InsulinPage from "./pages/InsulinPage";
import WizardInsulinRouter from "./pages/wizard/WizardInsulinRouter";
import HistoryPage from "./pages/HistoryPage";
import InsulinVariantsPage from "./pages/InsulinVariantsPage";
import { useNow } from "./state/useNow";
import { convertDimensions } from "./lib/util";
import Unit from "./models/unit";
import RescueVariantsPage from "./pages/RescueVariantsPage";
import { TerminalManager } from "./managers/terminalManager";
import { PrivateStore } from "./storage/privateStore";
import { initializeNodes, nodes } from "./storage/storageNode";
import ExpirationPage from "./pages/ExpirationPage";
import DebugPage from "./pages/DebugPage";
import { initThemeListener } from "./lib/themeManager";
import WizardSessionSelectPage from "./pages/wizard/WizardSessionSelectPage";
import TestPage from "./pages/TestPage";

function App() {
  // Load up values into nodes
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        // Wait for all nodes to fetch their data asynchronously
        await initializeNodes();
        initThemeListener();
      } catch (err) {
        console.error("Failed to initialize storage nodes:", err);
      } finally {
        // Mark as ready so the UI can render
        setIsLoaded(true);

        // Print some debug
        if (PrivateStore.debugLogs.value) {
          console.log(BackendStore);
          console.log(PrivateStore);
          for (let node of nodes) {
            console.log(node);
          }
          console.log(WizardStore.session.value);
          console.log(WizardStore.template.value);
          console.log(ActivityStore.activity.value);
          console.log(ActivityStore.template.value);
        }
      }
    })();
  }, []); // Empty dependency array = runs only once on mount

  const now = useNow(60);
  useEffect(() => {
    if (!isLoaded) return; // Skip periodic checks until initial load is done

    // Inject Bootstrap Icons CDN for Web runtime
    if (typeof document !== "undefined") {
      const linkId = "bootstrap-icons-cdn";
      if (!document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href =
          "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
        document.head.appendChild(link);
      }
    }

    // Update health monitor status cache
    updateHealthMonitorStatus();

    // Clean up inactive boluses
    cleanInactivePreviousBoluses();

    (async () => {
      // Upload stored inbox on terminal side
      await TerminalManager.fulfillInboxCache();

      // Fulfill Inbox on master side
      await TerminalManager.applyMail();

      // Synchronize master/slave state (if set)
      const shouldFulfill = await RemoteStorage.sync();
      if (shouldFulfill) return;

      // Attempt to fulfill requests
      await Backend.fulfillRequests();
      if (PrivateStore.debugLogs.value) console.warn("Sync Finished!");
    })();
  }, [now, isLoaded]);

  const redirectTimer = useNow(
    20 * convertDimensions(Unit.Time.Minute, Unit.Time.Second),
  );
  useEffect(() => {
    // Execute health monitor navigator
    //smartMonitor(navigate);
  }, [redirectTimer]);

  if (!isLoaded) {
    return (
      <div
        className="d-flex justify-content-center align-items-center vh-100"
        style={{ flex: 1, minHeight: "100%", width: "100%" }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading application data...</span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, minHeight: "100%", width: "100%" }}>
      <TopBar />
      <div className="app-shell" style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HubPage />} />
          <Route path="/hub" element={<HubPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="/customfoods" element={<CustomFoodsPage />} />
          <Route path="/dextrose" element={<DextrosePage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/rescue" element={<RescuePage />} />
          <Route path="/rescuevariants" element={<RescueVariantsPage />} />
          <Route path="/basal" element={<BasalPage />} />
          <Route path="/insulin" element={<InsulinPage />} />
          <Route path="/insulinvariants" element={<InsulinVariantsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/expirations" element={<ExpirationPage />} />
          <Route path="/test" element={<TestPage />} />

          {/* Wizard Routes */}
          <Route path="/wizard" element={<WizardRouterPage />} />
          <Route path="/wizard/intro" element={<WizardIntroPage />} />
          <Route path="/wizard/select" element={<WizardSelectionPage />} />
          <Route
            path="/wizard/selectsession"
            element={<WizardSessionSelectPage />}
          />
          <Route path="/wizard/hub" element={<Navigate to="/hub" replace />} />
          <Route path="/wizard/meal" element={<WizardMealPage />} />
          <Route path="/wizard/insulin" element={<WizardInsulinRouter />} />
          <Route path="/wizard/edit" element={<WizardEditPage />} />
          <Route path="/wizard/finalbg" element={<WizardFinalBGPage />} />

          {/* Activity Routes */}
          <Route path="/activity" element={<ActivityRouterPage />} />
          <Route path="/activity/select" element={<ActivitySelectPage />} />
          <Route path="/activity/start" element={<ActivityStartPage />} />
          <Route path="/activity/end" element={<ActivityEndPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;

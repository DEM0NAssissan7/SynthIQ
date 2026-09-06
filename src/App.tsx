import { Route, Routes } from "react-router";
import TopBar from "./components/TopBar";
import HubPage from "./pages/HubPage";
import SettingsPage from "./pages/SettingsPage";
import SetupPage from "./pages/SetupPage";
import { useEffect } from "react";
import CustomFoodsPage from "./pages/CustomFoodsPage";
import DextrosePage from "./pages/DextrosePage";
import StatisticsPage from "./pages/StatisticsPage";

import WizardEditPage from "./pages/wizard/WizardEditPage";
import RescuePage from "./pages/treatment/RescuePage";
import {
  cleanInactivePreviousBoluses,
  updateHealthMonitorStatus,
} from "./lib/healthMonitor";
import Backend from "./lib/remote/backend";
import RemoteStorage from "./lib/remote/storage";
import BasalPage from "./pages/treatment/BasalPage";
import { BackendStore } from "./storage/backendStore";
import { WizardStore } from "./storage/wizardStore";
import ActivityRouterPage from "./pages/activity/ActivityRouterPage";
import ActivitySelectPage from "./pages/activity/ActivitySelectPage";
import ActivityStartPage from "./pages/activity/ActivityStartPage";
import ActivityEndPage from "./pages/activity/ActivityEndPage";
import { ActivityStore } from "./storage/activityStore";
import InsulinPage from "./pages/treatment/InsulinPage";
import HistoryPage from "./pages/HistoryPage";
import InsulinVariantsPage from "./pages/InsulinVariantsPage";
import { useNow } from "./state/useNow";
import { convertDimensions } from "./lib/util";
import Unit from "./models/unit";
import RescueVariantsPage from "./pages/RescueVariantsPage";
import { PrivateStore } from "./storage/privateStore";
import { nodes } from "./storage/storageNode";
import ExpirationPage from "./pages/ExpirationPage";
import DebugPage from "./pages/DebugPage";
import { initThemeListener } from "./lib/themeManager";
import TestPage from "./pages/TestPage";
import { VERSION_STRING } from "./version";
import { initPwaUpdater, checkPwaUpdate } from "./lib/pwaUpdater";
import MealSelectionPage from "./pages/treatment/MealSelectionPage";
import MealPage from "./pages/treatment/MealPage";
import InsulinRouter from "./pages/treatment/InsulinRouter";
import PrebolusRouter from "./pages/treatment/PrebolusRouter";

function App() {
  useEffect(() => {
    initThemeListener();
    initPwaUpdater();
  }, []);

  if (PrivateStore.debugLogs.value) {
    console.log(BackendStore);
    console.log(PrivateStore);
    for (const node of nodes) {
      console.log(node);
    }
  }

  const now = useNow(60);
  useEffect(() => {
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
      // Synchronize master/slave state (if set)
      const shouldFulfill = await RemoteStorage.sync();
      if (shouldFulfill) return;

      // Attempt to fulfill requests
      await Backend.fulfillRequests();
      if (PrivateStore.debugLogs.value) console.warn("Sync Finished!");
    })();
  }, [now]);

  const redirectTimer = useNow(
    20 * convertDimensions(Unit.Time.Minute, Unit.Time.Second),
  );
  useEffect(() => {
    // Execute health monitor navigator
    //smartMonitor(navigate);
  }, [redirectTimer]);

  if (PrivateStore.debugLogs.value) {
    console.log(WizardStore.session.value);
    console.log(WizardStore.template.value);
    console.log(ActivityStore.activity.value);
    console.log(ActivityStore.template.value);
  }

  return (
    <div className="d-flex flex-column min-vh-100" style={{ width: "100%" }}>
      <TopBar />
      <div className="app-shell flex-grow-1">
        <Routes>
          <Route path="/" element={<HubPage />} />
          <Route path="/hub" element={<HubPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="/customfoods" element={<CustomFoodsPage />} />
          <Route path="/dextrose" element={<DextrosePage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/rescuevariants" element={<RescueVariantsPage />} />
          <Route path="/insulinvariants" element={<InsulinVariantsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/expirations" element={<ExpirationPage />} />
          <Route path="/test" element={<TestPage />} />

          {/* Treatments */}
          <Route path="/meal" element={<MealPage />} />
          <Route path="/selectmeal" element={<MealSelectionPage />} />
          <Route path="/insulin" element={<InsulinPage />} />
          <Route path="/prebolus" element={<PrebolusRouter />} />
          <Route path="/markinsulin" element={<InsulinRouter />} />
          <Route path="/rescue" element={<RescuePage />} />
          <Route path="/basal" element={<BasalPage />} />

          {/* Session Routes */}
          <Route path="/session/edit" element={<WizardEditPage />} />

          {/* Activity Routes */}
          <Route path="/activity" element={<ActivityRouterPage />} />
          <Route path="/activity/select" element={<ActivitySelectPage />} />
          <Route path="/activity/start" element={<ActivityStartPage />} />
          <Route path="/activity/end" element={<ActivityEndPage />} />
        </Routes>
      </div>
      <footer className="app-footer text-center">
        <button
          type="button"
          onClick={checkPwaUpdate}
          className="btn btn-link p-0 text-decoration-none app-version text-muted small"
          title={`SynthIQ ${VERSION_STRING} · Tap to check for updates`}
        >
          {VERSION_STRING}
        </button>
      </footer>
    </div>
  );
}

export default App;

import { Routes, Route, Navigate, useNavigate } from "react-router";
import TopBar from "./components/TopBar";
import HubPage from "./pages/HubPage";
import SettingsPage from "./pages/SettingsPage";
import SetupPage from "./pages/SetupPage";
import WizardIntroPage from "./pages/wizard/WizardIntroPage";
import WizardRouterPage from "./pages/wizard/WizardRouterPage";
import { useEffect } from "react";
import CustomFoodsPage from "./pages/CustomFoodsPage";
import DextrosePage from "./pages/DextrosePage";
import StatisticsPage from "./pages/StatisticsPage";
import WizardHubPage from "./pages/wizard/WizardHubPage";
import WizardMealPage from "./pages/wizard/WizardMealPage";
import WizardSelectionPage from "./pages/wizard/WizardSelectionPage";
import WizardFinalBGPage from "./pages/wizard/WizardFinalBGPage";
import WizardEditPage from "./pages/wizard/WizardEditPage";
import RescuePage from "./pages/RescuePage";
import { smartMonitor, updateHealthMonitorStatus } from "./lib/healthMonitor";
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
import { nodes } from "./storage/storageNode";
import ExpirationPage from "./pages/ExpirationPage";

function App() {
  if (PrivateStore.debugLogs.value) {
    console.log(BackendStore);
    console.log(PrivateStore);
    for (let node of nodes) {
      console.log(node);
    }
  }
  const navigate = useNavigate();
  const now = useNow(60);
  useEffect(() => {
    // Update health monitor status cache
    updateHealthMonitorStatus();

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
  }, [now]);

  const redirectTimer = useNow(
    20 * convertDimensions(Unit.Time.Minute, Unit.Time.Second)
  );
  useEffect(() => {
    // Execute health monitor navigator
    smartMonitor(navigate);
  }, [redirectTimer]);

  if (PrivateStore.debugLogs.value) {
    console.log(WizardStore.session.value);
    console.log(WizardStore.template.value);
    console.log(ActivityStore.activity.value);
    console.log(ActivityStore.template.value);
  }
  return (
    <div>
      <TopBar />
      <div style={{ padding: "20px" }}>
        <Routes>
          <Route
            path="/"
            element={
              Backend.urlIsValid() || BackendStore.skipSetup.value ? (
                ActivityStore.activity.value.started ? (
                  <Navigate to="/activity" replace />
                ) : WizardStore.session.value.started ? (
                  <Navigate to="/wizard" replace />
                ) : (
                  <Navigate to="/hub" replace />
                )
              ) : (
                <Navigate to="/setup" replace />
              )
            }
          />
          <Route path="/hub" element={<HubPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/settings" element={<SettingsPage />} />
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

          {/* Wizard Routes */}
          <Route path="/wizard" element={<WizardRouterPage />} />
          <Route path="/wizard/intro" element={<WizardIntroPage />} />
          <Route path="/wizard/select" element={<WizardSelectionPage />} />
          <Route path="/wizard/hub" element={<WizardHubPage />} />
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

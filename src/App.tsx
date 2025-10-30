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
import { smartMonitor } from "./lib/healthMonitor";
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

function App() {
  const navigate = useNavigate();
  const now = useNow(60);
  useEffect(() => {
    // Attempt to fulfill requests upon page load
    Backend.fulfillRequests();

    // Synchronize master/slave state (if set)
    RemoteStorage.sync();
  }, [now]);

  const redirectNow = useNow(
    20 * convertDimensions(Unit.Time.Minute, Unit.Time.Second)
  );
  useEffect(() => {
    // Execute health monitor navigator
    smartMonitor(navigate);
  }, [redirectNow]);

  console.log(WizardStore.session.value);
  console.log(WizardStore.template.value);
  console.log(ActivityStore.activity.value);
  console.log(ActivityStore.template.value);
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
          <Route path="/basal" element={<BasalPage />} />
          <Route path="/insulin" element={<InsulinPage />} />
          <Route path="/insulinvariants" element={<InsulinVariantsPage />} />
          <Route path="/history" element={<HistoryPage />} />

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

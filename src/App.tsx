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
import WizardInsulinPage from "./pages/wizard/WizardInsulinPage";

function App() {
  const navigate = useNavigate();
  useEffect(() => {
    // Attempt to fulfill requests upon page load
    Backend.fulfillRequests();

    // Synchronize master/slave state (if set)
    RemoteStorage.sync();

    // Execute health monitor
    smartMonitor(navigate);
  }, []);
  return (
    <div>
      <TopBar />
      <div style={{ padding: "20px" }}>
        <Routes>
          <Route
            path="/"
            element={
              Backend.urlIsValid() || BackendStore.skipSetup.value ? (
                WizardStore.session.value.started ? (
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

          {/* Wizard Routes */}
          <Route path="/wizard" element={<WizardRouterPage />} />
          <Route path="/wizard/intro" element={<WizardIntroPage />} />
          <Route path="/wizard/select" element={<WizardSelectionPage />} />
          <Route path="/wizard/hub" element={<WizardHubPage />} />
          <Route path="/wizard/meal" element={<WizardMealPage />} />
          <Route path="/wizard/insulin" element={<WizardInsulinPage />} />
          <Route path="/wizard/edit" element={<WizardEditPage />} />
          <Route path="/wizard/finalbg" element={<WizardFinalBGPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;

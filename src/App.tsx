import { Routes, Route, Navigate, useNavigate } from "react-router";
import TopBar from "./components/TopBar";
import WizardManager from "./lib/wizardManager";
import HubPage from "./pages/HubPage";
import SettingsPage from "./pages/SettingsPage";
import SetupPage from "./pages/SetupPage";
import WizardIntroPage from "./pages/template/WizardIntroPage";
import RouterPage from "./pages/template/RouterPage";
import { useEffect } from "react";
import CustomFoodsPage from "./pages/CustomFoodsPage";
import DextrosePage from "./pages/DextrosePage";
import StatisticsPage from "./pages/StatisticsPage";
import TemplateHubPage from "./pages/template/TemplateHubPage";
import TemplateMealPage from "./pages/template/TemplateMealPage";
import TemplateSelectionPage from "./pages/template/TemplateSelectionPage";
import TemplateInsulinPage from "./pages/template/TemplateInsulinPage";
import TemplateFinalBGPage from "./pages/template/TemplateFinalBGPage";
import TemplateEditPage from "./pages/template/TemplateEditPage";
import RescuePage from "./pages/RescuePage";
import { smartMonitor } from "./lib/healthMonitor";
import Backend from "./lib/remote/backend";
import RemoteStorage from "./lib/remote/storage";
import BasalPage from "./pages/BasalPage";

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
              Backend.urlIsValid() || Backend.getSkipped() ? (
                WizardManager.isActive() ? (
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
          <Route path="/wizard" element={<RouterPage />} />
          <Route path="/wizard/intro" element={<WizardIntroPage />} />

          {/* Template Routes */}
          <Route path="/template" element={<RouterPage />} />
          {/* We just reuse wizardrouter because it deals with it properly */}
          <Route path="/template/select" element={<TemplateSelectionPage />} />
          <Route path="/template/hub" element={<TemplateHubPage />} />
          <Route path="/template/meal" element={<TemplateMealPage />} />
          <Route path="/template/insulin" element={<TemplateInsulinPage />} />
          <Route path="/template/edit" element={<TemplateEditPage />} />
          <Route path="/template/finalbg" element={<TemplateFinalBGPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;

import { Routes, Route, Navigate } from "react-router";
import SetupPage from "./SetupPage";
import ProfilerPage from "./ProfilerPage";
import { nightscoutStorage } from "./lib/nightscoutManager";
import TopBar from "./components/TopBar";
import WizardRouterPage from "./WizardRouterPage";
import WizardIntroPage from "./wizard/WizardIntroPage";
import WizardMealPage from "./wizard/WizardMealPage";
import WizardInsulinPage from "./wizard/WizardInsulinPage";
import SettingsPage from "./SettingsPage";
import HubPage from "./hub";
import WizardManager from "./lib/wizardManager";
import WizardSummaryPage from "./wizard/WizardSummaryPage";

function App() {
  const condition = nightscoutStorage.get("url") !== null;
  return (
    <div>
      <TopBar />
      <div style={{ padding: "20px" }}>
        <Routes>
          <Route
            path="/"
            element={
              condition ? (
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
          <Route path="/profiler" element={<ProfilerPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Wizard Routes */}
          <Route path="/wizard" element={<WizardRouterPage />} />
          <Route path="/wizard/intro" element={<WizardIntroPage />} />
          <Route path="/wizard/meal" element={<WizardMealPage />} />
          <Route path="/wizard/insulin" element={<WizardInsulinPage />} />
          <Route path="/wizard/summary" element={<WizardSummaryPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;

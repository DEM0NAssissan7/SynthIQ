import { Routes, Route, Navigate } from "react-router";
import TopBar from "./components/TopBar";
import WizardManager from "./lib/wizardManager";
import HubPage from "./pages/HubPage";
import ProfilerPage from "./pages/ProfilerPage";
import SettingsPage from "./pages/SettingsPage";
import SetupPage from "./pages/SetupPage";
import WizardInsulinPage from "./pages/wizard/WizardInsulinPage";
import WizardIntroPage from "./pages/wizard/WizardIntroPage";
import WizardMealConfirmPage from "./pages/wizard/WizardMealConfirmPage";
import WizardMealPage from "./pages/wizard/WizardMealPage";
import WizardRouterPage from "./pages/wizard/WizardRouterPage";
import WizardSummaryPage from "./pages/wizard/WizardSummaryPage";
import NightscoutManager from "./lib/nightscoutManager";
import WizardGlucosePage from "./pages/wizard/WizardGlucosePage";

function App() {
  return (
    <div>
      <TopBar />
      <div style={{ padding: "20px" }}>
        <Routes>
          <Route
            path="/"
            element={
              NightscoutManager.urlIsValid() ||
              NightscoutManager.getNightscoutSkipped() ? (
                WizardManager.isActive() && !WizardManager.isComplete() ? (
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
          <Route
            path="/wizard/mealconfirm"
            element={<WizardMealConfirmPage />}
          />
          <Route path="/wizard/insulin" element={<WizardInsulinPage />} />
          <Route path="/wizard/summary" element={<WizardSummaryPage />} />
          <Route path="/wizard/glucose" element={<WizardGlucosePage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;

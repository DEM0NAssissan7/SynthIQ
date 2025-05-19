import { Routes, Route, Navigate } from "react-router";
import SetupPage from "./setup";
import ProfilerPage from "./profiler";
import { nightscoutStorage } from "./lib/nightscoutManager";
import TopBar from "./components/TopBar";
import WizardRouterPage from "./wizard";
import WizardIntroPage from "./wizard/intro";
import WizardMealPage from "./wizard/meal";
import WizardMealConfirmPage from "./wizard/mealconfirm";
import WizardInsulinPage from "./wizard/insulin";
import SettingsPage from "./settings";
import HubPage from "./hub";

function App() {
  const condition = nightscoutStorage.get("url") !== null; // Replace this with your actual condition

  return (
    <div>
      <TopBar />
      <div style={{ padding: "20px" }}>
        <Routes>
          <Route
            path="/"
            element={
              condition ? (
                <Navigate to="/hub" replace />
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
        </Routes>
      </div>
    </div>
  );
}

export default App;

import { Routes, Route, Navigate } from "react-router";
import SetupPage from "./setup";
import ProfilerPage from "./profiler";
import { nightscoutStorage } from "./lib/nightscoutManager";
import TopBar from "./TopBar";

function App() {
  const condition = nightscoutStorage.get("url") !== null; // Replace this with your actual condition

  return (
    <div>
      <TopBar></TopBar>
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
        <Route path="/profiler" element={<ProfilerPage />} />
        <Route path="/setup" element={<SetupPage />} />
      </Routes>
    </div>
  );
}

export default App;

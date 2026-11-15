import { createRoot } from "react-dom/client";
import "./index.scss";
import App from "./App.tsx";

import { BrowserRouter } from "react-router";
import { StrictMode } from "react";
import { initThemeListener } from "./lib/themeManager";
import { recordPageLoad } from "./lib/reloadLog";

recordPageLoad();

// Apply the theme before React's first paint; doing it in an effect paints
// one frame in the default palette first, which shows as a flash.
initThemeListener();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

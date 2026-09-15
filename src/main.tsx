import { createRoot } from "react-dom/client";
import "./index.scss";
import App from "./App.tsx";

import { BrowserRouter } from "react-router";
import { StrictMode } from "react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

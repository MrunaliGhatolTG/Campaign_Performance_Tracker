import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

/* This build runs on its own. Sample data is the default, so the app works
   with no server at all; set VITE_API=1 to talk to a real FastAPI instead
   (see the README). */
const useApi = import.meta.env.VITE_API === "1";

async function boot() {
  if (!useApi) {
    const { installMockApi } = await import("./preview/mockApi.js");
    await installMockApi();
  }

  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App sample={!useApi} />
    </React.StrictMode>,
  );
}

boot();

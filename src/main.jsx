import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { Analytics } from "@vercel/analytics/react";
import { registerServiceWorker } from "./utils/registerServiceWorker.js";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>
);

if (typeof window !== "undefined") {
  window.addEventListener(
    "load",
    () => {
      registerServiceWorker().catch(() => {});
    },
    { once: true }
  );
}

import React from "react";
import ReactDOM from "react-dom/client";
import "@easytable/ui/styles/globals.css";
import { I18nProvider } from "@easytable/ui/i18n";
import App from "./App";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // The app still works as a browser client if PWA registration fails.
    });
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);

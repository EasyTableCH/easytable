import React from "react";
import ReactDOM from "react-dom/client";
import "@easytable/ui/styles/globals.css";
import { I18nProvider } from "@easytable/ui/i18n";
import App from "./App";
import { initializeLocalMasterClient } from "./lib/local-master-client";

async function bootstrap() {
  await initializeLocalMasterClient();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
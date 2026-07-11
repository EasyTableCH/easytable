import React from "react";
import ReactDOM from "react-dom/client";
import { I18nProvider } from "@easytable/ui/i18n";
import { Toaster } from "@easytable/ui/components/sonner";

import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
      <Toaster position="top-right" richColors />
    </I18nProvider>
  </React.StrictMode>,
);

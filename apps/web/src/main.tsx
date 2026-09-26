import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { configureApi, configureLocalPersistence, createIndexedDbPersistence } from "@kunjae/client-core";

import { App } from "./app.tsx";
import { initLang } from "./i18n/index.ts";
import { refreshLocalPresence } from "./session/local-presence.ts";
import { startPwa } from "./pwa.ts";
import { initTheme } from "./theme.ts";
import "./styles.css";

initTheme();
initLang();

const apiBaseUrl: unknown = import.meta.env["VITE_API_BASE_URL"];

if (typeof apiBaseUrl !== "string" || !configureApi(apiBaseUrl).ok) {
  throw new Error("Invalid VITE_API_BASE_URL — it must use https (http://127.0.0.1 is allowed for development)");
}

// eslint-disable-next-line no-restricted-globals
configureLocalPersistence(createIndexedDbPersistence(indexedDB));
void refreshLocalPresence();

startPwa();

const container = document.getElementById("root");

if (container === null) throw new Error("#root not found in index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

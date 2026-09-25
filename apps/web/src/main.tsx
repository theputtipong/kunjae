import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { configureApi } from "@kunjae/client-core";

import { App } from "./app.tsx";
import { startPwa } from "./pwa.ts";
import "./styles.css";

const apiBaseUrl: unknown = import.meta.env["VITE_API_BASE_URL"];

if (typeof apiBaseUrl !== "string" || !configureApi(apiBaseUrl).ok) {
  throw new Error("VITE_API_BASE_URL ไม่ถูกต้อง — ต้องเป็น https (ยกเว้น http://127.0.0.1 ตอนพัฒนา)");
}

startPwa();

const container = document.getElementById("root");

if (container === null) throw new Error("ไม่พบ #root ใน index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

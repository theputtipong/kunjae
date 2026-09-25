import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Popup } from "./popup.tsx";
import "./style.css";

const container = document.getElementById("root");
if (container === null) throw new Error("ไม่พบ #root");

createRoot(container).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);

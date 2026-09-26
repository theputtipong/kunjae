import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { dictionary } from "../../i18n.ts";

import { Popup } from "./popup.tsx";
import "./style.css";

document.documentElement.lang = dictionary().htmlLang;

const container = document.getElementById("root");
if (container === null) throw new Error("Missing #root");

createRoot(container).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);

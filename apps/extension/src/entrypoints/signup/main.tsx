import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SignUpPage } from "./signup.tsx";
import "../popup/style.css";

const container = document.getElementById("root");
if (container === null) throw new Error("ไม่พบ #root");

createRoot(container).render(
  <StrictMode>
    <SignUpPage />
  </StrictMode>,
);

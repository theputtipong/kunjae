import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { dictionary } from "../../i18n.ts";

import { SignUpPage } from "./signup.tsx";
import { ChangeLocalPasswordPage, CreateLocalPage } from "./local-setup.tsx";
import { OnboardingPage } from "./onboarding.tsx";
import "../popup/style.css";

document.documentElement.lang = dictionary().htmlLang;

const container = document.getElementById("root");
if (container === null) throw new Error("Missing #root");

const mode = new URLSearchParams(window.location.search).get("mode");

const Page =
  mode === "welcome"
    ? OnboardingPage
    : mode === "local"
      ? CreateLocalPage
      : mode === "local-password"
        ? ChangeLocalPasswordPage
        : SignUpPage;

createRoot(container).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);

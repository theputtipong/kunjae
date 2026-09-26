import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

import { getSessionView } from "@kunjae/client-core";
import { RootLayout } from "./routes/root.tsx";
import { EmergencyKitPage } from "./routes/emergency-kit.tsx";
import { SettingsPage } from "./routes/settings.tsx";
import { SignUpPage } from "./routes/sign-up.tsx";
import { UnlockPage } from "./routes/unlock.tsx";
import { StartPage } from "./routes/start.tsx";
import { CreateLocalPage } from "./routes/create-local.tsx";
import { VaultPage } from "./routes/vault.tsx";
import { WelcomePage } from "./routes/welcome.tsx";
import { PrivacyPage, TermsPage } from "./routes/legal.tsx";
import { onboardingSeen } from "./session/onboarding.ts";
import { getLocalPresence } from "./session/local-presence.ts";

const rootRoute = createRootRoute({ component: RootLayout });

const requireUnlocked = (): void => {
  if (getSessionView().status === "locked") {
    throw redirect({ to: "/" });
  }
};

const redirectIfUnlocked = (): void => {
  if (getSessionView().status === "unlocked") throw redirect({ to: "/vault" });
};

const startRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: StartPage,
  beforeLoad: () => {
    redirectIfUnlocked();
    if (!onboardingSeen() && getLocalPresence() !== "present") throw redirect({ to: "/welcome" });
  },
});

const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/welcome",
  component: WelcomePage,
});

const unlockRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: UnlockPage,
  beforeLoad: () => {
    if (getSessionView().mode === "account") throw redirect({ to: "/vault" });
  },
});

const createLocalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/start-local",
  component: CreateLocalPage,
  beforeLoad: redirectIfUnlocked,
});

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up",
  component: SignUpPage,
});

const emergencyKitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/emergency-kit",
  component: EmergencyKitPage,
});

const vaultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vault",
  component: VaultPage,
  beforeLoad: requireUnlocked,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
  beforeLoad: requireUnlocked,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPage,
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: TermsPage,
});

export const routeTree = rootRoute.addChildren([
  privacyRoute,
  termsRoute,
  startRoute,
  welcomeRoute,
  unlockRoute,
  createLocalRoute,
  signUpRoute,
  emergencyKitRoute,
  vaultRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

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
import { VaultPage } from "./routes/vault.tsx";

const rootRoute = createRootRoute({ component: RootLayout });

const requireUnlocked = (): void => {
  if (getSessionView().status === "locked") {
    throw redirect({ to: "/" });
  }
};

const unlockRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: UnlockPage,
  beforeLoad: () => {
    if (getSessionView().status === "unlocked") throw redirect({ to: "/vault" });
  },
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

export const routeTree = rootRoute.addChildren([
  unlockRoute,
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

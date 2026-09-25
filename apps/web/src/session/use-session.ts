import { useSyncExternalStore } from "react";

import { getSessionView, subscribeToSession, type SessionView } from "@kunjae/client-core";

export const useSession = (): SessionView =>
  useSyncExternalStore(subscribeToSession, getSessionView, getSessionView);

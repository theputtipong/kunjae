import type { EmergencyKit } from "./auth.ts";

let pending: EmergencyKit | null = null;

export const holdEmergencyKit = (kit: EmergencyKit): void => {
  pending = kit;
};

export const takeEmergencyKit = (): EmergencyKit | null => {
  const kit = pending;
  pending = null;
  return kit;
};

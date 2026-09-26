const STORAGE_KEY = "kunjae.onboarding.v1";

export const onboardingSeen = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "seen";
  } catch {
    return false;
  }
};

export const markOnboardingSeen = (): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, "seen");
  } catch {
    return;
  }
};

export const originOf = (rawUrl: string | undefined | null): string | null => {
  if (rawUrl === undefined || rawUrl === null || rawUrl === "") return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  if (url.hostname.endsWith(".")) return null;

  return url.origin;
};

export const hostOf = (rawUrl: string | undefined | null): string => {
  const origin = originOf(rawUrl);
  if (origin === null) return "";

  return new URL(origin).host;
};

export type FillDecision =
  | { readonly allowed: true; readonly origin: string }
  | { readonly allowed: false; readonly reason: "no-saved-url" }
  | { readonly allowed: false; readonly reason: "unsupported-page" }
  | { readonly allowed: false; readonly reason: "no-tab-access" }
  | {
      readonly allowed: false;
      readonly reason: "origin-mismatch";
      readonly tabOrigin: string;
      readonly savedOrigin: string;
    };

export const decideFill = (
  tabUrl: string | undefined | null,
  savedUrl: string | undefined | null,
): FillDecision => {
  const savedOrigin = originOf(savedUrl);
  if (savedOrigin === null) return { allowed: false, reason: "no-saved-url" };

  if (tabUrl === undefined || tabUrl === null || tabUrl === "") {
    return { allowed: false, reason: "no-tab-access" };
  }

  const tabOrigin = originOf(tabUrl);
  if (tabOrigin === null) return { allowed: false, reason: "unsupported-page" };

  if (tabOrigin !== savedOrigin) {
    return { allowed: false, reason: "origin-mismatch", tabOrigin, savedOrigin };
  }

  return { allowed: true, origin: tabOrigin };
};

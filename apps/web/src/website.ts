const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

export const normalizeWebsite = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  if (SCHEME_PATTERN.test(trimmed)) return trimmed;

  const candidate = `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.hostname === "" || url.username !== "" || url.password !== "") return null;

  return candidate;
};

export type ContactConfig = {
  readonly resendApiKey: string;
  readonly from: string;
  readonly to: string;
};

const EMAIL_ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u;

const DISPLAY_ADDRESS = /^[^<>\r\n]*<([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)>$/u;

const readString = (env: unknown, name: string): string | null => {
  if (typeof env !== "object" || env === null) return null;
  const raw: unknown = (env as Record<string, unknown>)[name];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
};

export const readContactConfig = (env: unknown): ContactConfig | null => {
  const resendApiKey = readString(env, "RESEND_API_KEY");
  const from = readString(env, "CONTACT_FROM");
  const to = readString(env, "CONTACT_TO");
  if (resendApiKey === null || from === null || to === null) return null;
  if (!EMAIL_ADDRESS.test(to)) return null;
  if (!EMAIL_ADDRESS.test(from) && !DISPLAY_ADDRESS.test(from)) return null;
  return { resendApiKey, from, to };
};

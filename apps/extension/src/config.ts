const DEV_API_BASE_URL = "http://127.0.0.1:8787";

export const apiBaseUrl = (): string => {
  const configured: unknown = import.meta.env["WXT_API_BASE_URL"];
  return typeof configured === "string" && configured.length > 0 ? configured : DEV_API_BASE_URL;
};

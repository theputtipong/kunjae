import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const headersWithApiOrigin = (apiBaseUrl: string | undefined): Plugin => ({
  name: "kunjae-headers-api-origin",
  apply: "build",
  closeBundle() {
    const file = resolve(import.meta.dirname, "dist/_headers");
    const origin = apiBaseUrl === undefined || apiBaseUrl === "" ? "" : new URL(apiBaseUrl).origin;
    if (origin === "") this.warn("VITE_API_BASE_URL not set — connect-src allows 'self' only");
    const headers = readFileSync(file, "utf8").replaceAll(origin === "" ? " __API_ORIGIN__" : "__API_ORIGIN__", origin);
    writeFileSync(file, headers);
  },
});

const appVersion = (): string => {
  const manifest: unknown = JSON.parse(readFileSync(resolve(import.meta.dirname, "package.json"), "utf8"));
  if (typeof manifest === "object" && manifest !== null && "version" in manifest && typeof manifest.version === "string") {
    return manifest.version;
  }
  return "0.0.0";
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "VITE_");

  return {
    plugins: [react(), tailwindcss(), headersWithApiOrigin(env["VITE_API_BASE_URL"])],

    define: {
      __APP_VERSION__: JSON.stringify(appVersion()),
    },

    build: {
      target: "esnext",
      sourcemap: false,
    },

    server: {
      host: "127.0.0.1",
      port: 5173,
    },
  };
});

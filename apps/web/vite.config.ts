import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const headersWithApiOrigin = (apiBaseUrl: string | undefined): Plugin => ({
  name: "kunjae-headers-api-origin",
  apply: "build",
  closeBundle() {
    if (apiBaseUrl === undefined || apiBaseUrl === "") {
      throw new Error("VITE_API_BASE_URL is required to build _headers");
    }
    const file = resolve(__dirname, "dist/_headers");
    const origin = new URL(apiBaseUrl).origin;
    writeFileSync(file, readFileSync(file, "utf8").replaceAll("__API_ORIGIN__", origin));
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");

  return {
    plugins: [react(), tailwindcss(), headersWithApiOrigin(env["VITE_API_BASE_URL"])],

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

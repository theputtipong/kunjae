import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

const apiBaseUrl = process.env["WXT_API_BASE_URL"] ?? "http://127.0.0.1:8787";

const apiHostPermission = `${new URL(apiBaseUrl).origin}/*`;

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],

  vite: () => ({ plugins: [tailwindcss()] }),

  manifest: {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",

    permissions: ["activeTab", "scripting", "clipboardWrite"],

    host_permissions: [apiHostPermission],

    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'",
    },

    icons: { 16: "/icon/16.png", 32: "/icon/32.png", 48: "/icon/48.png", 128: "/icon/128.png" },
    action: {
      default_title: "Kunjae",
      default_icon: { 16: "/action/locked-light-16.png", 32: "/action/locked-light-32.png" },
    },
  },
});

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

const FORBIDDEN_BROWSER_GLOBALS = [
  { name: "window", message: "core-crypto ต้องรันได้ทุก runtime — ห้ามผูกกับเบราว์เซอร์" },
  { name: "document", message: "core-crypto ต้องไม่รู้จัก DOM" },
  { name: "localStorage", message: "ห้ามเก็บข้อมูลลับลงที่เก็บถาวรที่ไม่เข้ารหัส" },
  { name: "sessionStorage", message: "ห้ามเก็บข้อมูลลับลงที่เก็บถาวรที่ไม่เข้ารหัส" },
  { name: "indexedDB", message: "I/O ต้องอยู่ในชั้น infrastructure เท่านั้น" },
  { name: "fetch", message: "core-crypto ต้องไม่มีการเชื่อมต่อเครือข่ายเด็ดขาด" },
  { name: "XMLHttpRequest", message: "core-crypto ต้องไม่มีการเชื่อมต่อเครือข่ายเด็ดขาด" },
  { name: "location", message: "core-crypto ต้องไม่รู้จักบริบทของหน้าเว็บ" },
  { name: "navigator", message: "core-crypto ต้องไม่รู้จักบริบทของหน้าเว็บ" },
  { name: "alert", message: "core-crypto ต้องไม่มี UI" },
];

const FORBIDDEN_NODE_GLOBALS = [
  { name: "process", message: "ไม่มีในเบราว์เซอร์ — core-crypto ต้อง runtime agnostic" },
  { name: "Buffer", message: "ไม่มีในเบราว์เซอร์ — ใช้ Uint8Array แทน" },
  { name: "__dirname", message: "ไม่มีในโมดูล ESM และในเบราว์เซอร์" },
  { name: "require", message: "โปรเจกต์นี้เป็น ESM ทั้งหมด" },
];

const FORBIDDEN_PROPERTIES = [
  {
    object: "Math",
    property: "random",
    message: "ห้ามใช้เด็ดขาด — ใช้ randomBytes/randomInt จาก primitives/random.ts",
  },
];

const RESTRICTED_WEBCRYPTO = [
  {
    selector: "MemberExpression[property.name='getRandomValues']",
    message: "เรียกได้เฉพาะใน primitives/random.ts — ที่อื่นให้ใช้ randomBytes()",
  },
  {
    selector: "MemberExpression[property.name='subtle']",
    message: "เรียกได้เฉพาะใน primitives/aead.ts — ที่อื่นให้ใช้ seal()/open()",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/.wrangler/**",

      "apps/api/worker-configuration.d.ts",

      "apps/extension/.wxt/**",
      "apps/extension/.output/**",
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-properties": ["error", ...FORBIDDEN_PROPERTIES],

      eqeqeq: ["error", "always"],

      "@typescript-eslint/no-explicit-any": "error",

      "@typescript-eslint/no-non-null-assertion": "error",

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",

      "@typescript-eslint/consistent-type-definitions": "off",
    },
  },

  {
    files: ["packages/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...FORBIDDEN_BROWSER_GLOBALS,
        ...FORBIDDEN_NODE_GLOBALS,
      ],

      "no-console": "error",

      "no-restricted-syntax": ["error", ...RESTRICTED_WEBCRYPTO],

      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/apps/**", "../../apps/*", "@kunjae/web*", "@kunjae/extension*", "@kunjae/api*"],
              message: "packages/ ห้าม import จาก apps/ — ลูกศรของ Clean Architecture ชี้ทางเดียว",
            },
            {
              group: ["@kunjae/*/src/*"],
              message: "ห้ามลัดเข้าไฟล์ภายในของ package อื่น — ใช้ทางเข้าที่ประกาศใน exports เท่านั้น",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["packages/client-core/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "localStorage",
          message: "ห้ามเก็บอะไรลงที่เก็บถาวร — กุญแจต้องอยู่ในหน่วยความจำเท่านั้น",
        },
        {
          name: "sessionStorage",
          message: "ห้ามเก็บอะไรลงที่เก็บถาวร — กุญแจต้องอยู่ในหน่วยความจำเท่านั้น",
        },
        {
          name: "indexedDB",
          message: "ถ้าจำเป็นต้องเก็บข้อมูลออฟไลน์ ต้องเก็บเฉพาะ ciphertext และต้องออกแบบก่อน",
        },
        { name: "window", message: "ต้องรันได้ใน service worker ที่ไม่มี window" },
        { name: "document", message: "ต้องรันได้ใน service worker ที่ไม่มี DOM" },
        { name: "location", message: "ชั้นนี้ต้องไม่รู้จักบริบทของหน้าเว็บ" },
      ],

      "no-console": "error",
      "no-restricted-syntax": ["error", ...RESTRICTED_WEBCRYPTO],
    },
  },

  {
    files: ["apps/api/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...FORBIDDEN_BROWSER_GLOBALS,

        ...FORBIDDEN_NODE_GLOBALS,
      ],

      "no-console": ["error", { allow: ["error", "warn"] }],

      "no-restricted-syntax": ["error", ...RESTRICTED_WEBCRYPTO],

      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@kunjae/domain", "@kunjae/domain/*"],
              message:
                "server ไม่มีกุญแจและต้องไม่แตะเนื้อหาของผู้ใช้ — ใช้ได้เฉพาะ @kunjae/contracts",
            },
            {
              group: ["@kunjae/*/src/*"],
              message: "ห้ามลัดเข้าไฟล์ภายในของ package อื่น — ใช้ทางเข้าที่ประกาศใน exports เท่านั้น",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs["recommended-latest"].rules,

      "no-restricted-globals": [
        "error",
        {
          name: "localStorage",
          message: "ห้ามเก็บอะไรลงที่เก็บถาวร — กุญแจต้องอยู่ในหน่วยความจำและหายไปเมื่อปิดแท็บ",
        },
        {
          name: "sessionStorage",
          message: "ห้ามเก็บอะไรลงที่เก็บถาวร — กุญแจต้องอยู่ในหน่วยความจำและหายไปเมื่อปิดแท็บ",
        },
        {
          name: "indexedDB",
          message: "ถ้าจำเป็นต้องเก็บข้อมูลออฟไลน์ ต้องเก็บเฉพาะ ciphertext และต้องออกแบบก่อน",
        },
      ],

      "no-console": "error",

      "no-restricted-syntax": ["error", ...RESTRICTED_WEBCRYPTO],

      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@kunjae/*/src/*"],
              message: "ห้ามลัดเข้าไฟล์ภายในของ package อื่น — ใช้ทางเข้าที่ประกาศใน exports เท่านั้น",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["apps/extension/**/*.ts", "apps/extension/**/*.tsx"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs["recommended-latest"].rules,

      "no-restricted-globals": [
        "error",
        {
          name: "localStorage",
          message: "ห้ามเก็บอะไรลงที่เก็บถาวร — กุญแจอยู่ในหน่วยความจำของ service worker เท่านั้น",
        },
        {
          name: "sessionStorage",
          message: "ห้ามเก็บอะไรลงที่เก็บถาวร — กุญแจอยู่ในหน่วยความจำของ service worker เท่านั้น",
        },
        {
          name: "indexedDB",
          message: "ห้ามเก็บอะไรลงที่เก็บถาวร — ส่วนขยายนี้ไม่ขอสิทธิ์ storage โดยเจตนา",
        },
      ],

      "no-console": "error",

      "no-restricted-syntax": ["error", ...RESTRICTED_WEBCRYPTO],

      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@kunjae/*/src/*"],
              message: "ห้ามลัดเข้าไฟล์ภายในของ package อื่น — ใช้ทางเข้าที่ประกาศใน exports เท่านั้น",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["packages/core-crypto/src/primitives/random.ts"],
    rules: {
      "no-restricted-syntax": ["error", RESTRICTED_WEBCRYPTO[1]],
    },
  },
  {
    files: ["packages/core-crypto/src/primitives/aead.ts"],
    rules: {
      "no-restricted-syntax": ["error", RESTRICTED_WEBCRYPTO[0]],
    },
  },

  {
    files: ["apps/api/src/crypto/hmac.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  {
    files: ["apps/web/src/router.tsx"],
    rules: {
      "@typescript-eslint/only-throw-error": "off",
    },
  },

  {
    files: ["packages/crypto-spec/scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },

  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-globals": "off",
    },
  },

  {
    files: ["apps/web/public/sw.js"],
    languageOptions: {
      globals: { ...globals.serviceworker },
    },
  },
);

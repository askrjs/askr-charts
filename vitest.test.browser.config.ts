import { askr } from "@askrjs/vite";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig } from "vite-plus/test/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@askrjs/charts": fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
  },
  plugins: [askr()],
  test: {
    globals: true,
    setupFiles: ["tests/browser/setup.ts"],
    passWithNoTests: true,
    api: {
      host: "127.0.0.1",
    },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
      api: {
        host: "127.0.0.1",
        port: 0,
      },
    },
    include: ["tests/browser/**/*.test.tsx"],
  },
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "@askrjs/askr",
    },
    jsxInject: "import { jsx, jsxs, Fragment } from '@askrjs/askr/jsx-runtime';",
  },
});

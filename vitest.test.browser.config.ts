import { askr } from "@askrjs/vite";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig } from "vite-plus/test/config";

export default defineConfig({
  plugins: [askr()],
  test: {
    globals: true,
    passWithNoTests: true,
    api: {
      host: "127.0.0.1",
    },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
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

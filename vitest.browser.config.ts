import { askr } from "@askrjs/askr-vite";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [askr()],
  test: {
    globals: true,
    passWithNoTests: true,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    include: ["tests/**/*.browser.test.tsx"],
  },
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "@askrjs/askr",
    },
    jsxInject: "import { jsx, jsxs, Fragment } from '@askrjs/askr/jsx-runtime';",
  },
  resolve: {
    preserveSymlinks: true,
  },
});

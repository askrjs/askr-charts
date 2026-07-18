import { askr } from "@askrjs/vite";
import { fileURLToPath } from "node:url";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig } from "vite-plus/test/config";

export default defineConfig({
  plugins: [askr()],
  resolve: {
    alias: { "@askrjs/charts": fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
  },
  test: {
    globals: true,
    setupFiles: ["tests/browser/setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      api: { host: "127.0.0.1", port: 0 },
    },
    include: ["tests/visual/**/*.test.tsx"],
  },
  oxc: {
    jsx: { runtime: "automatic", importSource: "@askrjs/askr" },
    jsxInject: "import { jsx, jsxs, Fragment } from '@askrjs/askr/jsx-runtime';",
  },
});

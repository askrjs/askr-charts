import { askr } from "@askrjs/vite";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig } from "vite-plus";
import { sharedVitestConfig } from "./vitest.test.shared";

const browserConfig = {
  ...sharedVitestConfig,
  plugins: [askr()],
  test: {
    ...sharedVitestConfig.test,
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
} as unknown as Parameters<typeof defineConfig>[0];

export default defineConfig(browserConfig);

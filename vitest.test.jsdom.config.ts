import { defineConfig } from "vite-plus";
import { sharedVitestConfig } from "./vitest.test.shared";

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    ...sharedVitestConfig.test,
    environment: "jsdom",
    include: ["tests/**/*.test.tsx"],
    exclude: [
      "tests/**/*.browser.test.tsx",
      "tests/browser/**/*.test.tsx",
      "tests/visual/**/*.test.tsx",
    ],
  },
});

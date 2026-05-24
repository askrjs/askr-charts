import { defineConfig } from "vite-plus";
import { sharedVitestConfig } from "./vitest.test.shared";

const tier3Include = ["benches/tier3/**/*.bench.ts", "benches/tier3/**/*.bench.tsx"];

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    ...sharedVitestConfig.test,
    environment: "jsdom",
    passWithNoTests: true,
    include: tier3Include,
    benchmark: {
      include: tier3Include,
    },
  },
});

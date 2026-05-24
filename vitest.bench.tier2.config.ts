import { defineConfig } from "vite-plus";
import { sharedVitestConfig } from "./vitest.test.shared";

const tier2Include = ["benches/tier2/**/*.bench.ts", "benches/tier2/**/*.bench.tsx"];

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    ...sharedVitestConfig.test,
    environment: "jsdom",
    passWithNoTests: true,
    include: tier2Include,
    benchmark: {
      include: tier2Include,
    },
  },
});

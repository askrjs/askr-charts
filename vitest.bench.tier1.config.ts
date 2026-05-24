import { defineConfig } from "vite-plus";
import { sharedVitestConfig } from "./vitest.test.shared";

const tier1Include = ["benches/tier1/**/*.bench.ts", "benches/tier1/**/*.bench.tsx"];

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    ...sharedVitestConfig.test,
    environment: "node",
    passWithNoTests: true,
    include: tier1Include,
    benchmark: {
      include: tier1Include,
    },
  },
});

import { defineConfig } from "vite-plus";
import browserConfig from "./vitest.test.browser.config";

const tier4Include = ["benches/tier4/**/*.bench.ts", "benches/tier4/**/*.bench.tsx"];

export default defineConfig({
  ...browserConfig,
  test: {
    ...browserConfig.test,
    passWithNoTests: true,
    include: tier4Include,
    benchmark: {
      include: tier4Include,
    },
  },
});

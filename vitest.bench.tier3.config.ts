import { defineConfig } from "vite-plus";
import { benchmarkThresholdReporter } from "./benches/_shared/threshold-reporter";
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
      reporters: [
        "default",
        benchmarkThresholdReporter([
          {
            name: "warm pan/zoom transient frame (p99 proxy <=16.7ms)",
            p99Milliseconds: 16.7,
          },
          {
            name: "100k-source spatial hit query (p99 proxy <=2ms)",
            p99Milliseconds: 2,
          },
          {
            name: "append and repaint a 1k followed batch (p99 proxy <=50ms)",
            p99Milliseconds: 50,
          },
        ]),
      ],
    },
  },
});

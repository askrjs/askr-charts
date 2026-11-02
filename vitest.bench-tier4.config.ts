import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite-plus";
import { benchmarkThresholdReporter } from "./benches/_shared/threshold-reporter";
import { sharedVitestConfig } from "./vitest.test.shared";

const tier4Include = ["benches/tier4/**/*.bench.ts", "benches/tier4/**/*.bench.tsx"];

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    ...sharedVitestConfig.test,
    include: tier4Include,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    benchmark: {
      include: tier4Include,
      reporters: [
        "default",
        benchmarkThresholdReporter([
          {
            name: "mount, compile, and paint a 100k line plot (<=250ms)",
            p99Milliseconds: 250,
          },
          {
            name: "warm real-canvas 100k scene repaint (p99 proxy <=16.7ms)",
            p99Milliseconds: 16.7,
          },
        ]),
      ],
    },
  },
});

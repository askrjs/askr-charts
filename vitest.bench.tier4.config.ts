import { defineConfig } from "vite-plus";
import { benchmarkThresholdReporter } from "./benches/_shared/threshold-reporter";
import browserConfig from "./vitest.test.browser.config";

const tier4Include = ["benches/tier4/**/*.bench.ts", "benches/tier4/**/*.bench.tsx"];

const tier4Config = {
  ...browserConfig,
  test: {
    ...(browserConfig as { test: Record<string, unknown> }).test,
    passWithNoTests: true,
    include: tier4Include,
    benchmark: {
      include: tier4Include,
      reporters: [
        "default",
        benchmarkThresholdReporter([
          {
            name: "mount, compile, and paint a 100k line plot (<=250ms)",
            p99Milliseconds: 250,
          },
        ]),
      ],
    },
  },
} as unknown as Parameters<typeof defineConfig>[0];

export default defineConfig(tier4Config);

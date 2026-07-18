import { askr } from "@askrjs/vite";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig } from "vite-plus/test/config";
import { benchmarkThresholdReporter } from "./benches/_shared/threshold-reporter";

const tier4Include = ["benches/tier4/**/*.bench.ts", "benches/tier4/**/*.bench.tsx"];

export default defineConfig({
  plugins: [askr()],
  test: {
    globals: true,
    passWithNoTests: true,
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
          {
            name: "warm real-canvas 100k scene repaint (p99 proxy <=16.7ms)",
            p99Milliseconds: 16.7,
          },
        ]),
      ],
    },
  },
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "@askrjs/askr",
    },
    jsxInject: "import { jsx, jsxs, Fragment } from '@askrjs/askr/jsx-runtime';",
  },
});

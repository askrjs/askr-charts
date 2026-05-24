import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

const correctnessCoverage = {
  AreaChart: ["tests/charts.test.ts", "tests/component-surfaces.test.tsx"],
  BarChart: ["tests/charts.test.ts", "tests/chart-rendering.test.tsx"],
  ChartEmptyState: ["tests/component-surfaces.test.tsx"],
  ChartLegend: ["tests/component-surfaces.test.tsx"],
  ChartPanel: ["tests/component-surfaces.test.tsx"],
  ChartShell: ["tests/component-surfaces.test.tsx"],
  DonutChart: ["tests/charts.test.ts", "tests/chart-rendering.browser.test.tsx"],
  FlameGraph: ["tests/charts.test.ts", "tests/chart-rendering.browser.test.tsx"],
  Heatmap: ["tests/charts.test.ts", "tests/chart-rendering.browser.test.tsx"],
  LineChart: ["tests/charts.test.ts", "tests/component-surfaces.test.tsx"],
  ProgressMeter: ["tests/charts.test.ts", "tests/chart-rendering.browser.test.tsx"],
  RadialGauge: ["tests/component-surfaces.test.tsx", "tests/chart-rendering.browser.test.tsx"],
  Sparkline: ["tests/component-surfaces.test.tsx", "tests/chart-rendering.browser.test.tsx"],
  StackedBarChart: ["tests/charts.test.ts", "tests/chart-rendering.browser.test.tsx"],
  Timeline: ["tests/charts.test.ts", "tests/chart-rendering.browser.test.tsx"],
} as const;

const benchmarkCoverage = {
  AreaChart: ["benches/tier2/public-render.bench.tsx"],
  BarChart: ["benches/tier2/public-render.bench.tsx", "benches/tier3/mounted-subsystems.bench.tsx"],
  ChartEmptyState: ["benches/tier2/public-render.bench.tsx"],
  ChartLegend: ["benches/tier2/public-render.bench.tsx", "benches/_shared/fixtures.tsx"],
  ChartPanel: ["benches/tier2/public-render.bench.tsx", "benches/_shared/fixtures.tsx"],
  ChartShell: ["benches/tier2/public-render.bench.tsx", "benches/_shared/fixtures.tsx"],
  DonutChart: ["benches/tier2/public-render.bench.tsx", "benches/tier4/browser-flows.bench.tsx"],
  FlameGraph: ["benches/tier2/public-render.bench.tsx", "benches/_shared/fixtures.tsx"],
  Heatmap: ["benches/tier2/public-render.bench.tsx", "benches/tier3/mounted-subsystems.bench.tsx"],
  LineChart: ["benches/tier2/public-render.bench.tsx"],
  ProgressMeter: ["benches/tier2/public-render.bench.tsx", "benches/_shared/fixtures.tsx"],
  RadialGauge: ["benches/tier2/public-render.bench.tsx"],
  Sparkline: ["benches/tier2/public-render.bench.tsx"],
  StackedBarChart: ["benches/tier2/public-render.bench.tsx", "benches/_shared/fixtures.tsx"],
  Timeline: ["benches/tier2/public-render.bench.tsx", "benches/tier3/mounted-subsystems.bench.tsx"],
} as const;

function read(relativePath: string): string {
  return readFileSync(join(__dirname, "..", relativePath), "utf8");
}

describe("component coverage contract", () => {
  it("keeps direct correctness coverage for every exported component", () => {
    for (const [componentName, files] of Object.entries(correctnessCoverage)) {
      for (const file of files) {
        expect(read(file), `${componentName} must appear in ${file}`).toContain(componentName);
      }
    }
  });

  it("keeps direct benchmark coverage for every exported component", () => {
    for (const [componentName, files] of Object.entries(benchmarkCoverage)) {
      for (const file of files) {
        expect(read(file), `${componentName} must appear in ${file}`).toContain(componentName);
      }
    }
  });
});
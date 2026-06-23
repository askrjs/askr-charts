import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const contractCharts = [
  ["AreaChart", "area-chart-example.tsx"],
  ["BarChart", "bar-chart-example.tsx"],
  ["LineChart", "line-chart-example.tsx"],
  ["DonutChart", "donut-chart-example.tsx"],
  ["StackedBarChart", "stacked-bar-chart-example.tsx"],
  ["Sparkline", "sparkline-example.tsx"],
  ["Heatmap", "heatmap-example.tsx"],
  ["Timeline", "timeline-example.tsx"],
  ["FlameGraph", "flame-graph-example.tsx"],
  ["ProgressMeter", "progress-meter-example.tsx"],
  ["RadialGauge", "radial-gauge-example.tsx"],
] as const;

function getChartSection(docs: string, chartName: string): string {
  const start = docs.indexOf(`### ${chartName}`);
  expect(start, `${chartName} section should exist`).toBeGreaterThanOrEqual(0);

  const next = docs.indexOf("\n### ", start + 1);
  return next === -1 ? docs.slice(start) : docs.slice(start, next);
}

describe("chart contract documentation", () => {
  it("should keeps package docs, exports, and the app gallery aligned", () => {
    const packageRoot = join(__dirname, "..");
    const repoRoot = join(packageRoot, "..");
    const docs = readFileSync(join(packageRoot, "CHARTING.md"), "utf8");
    const exportsFile = readFileSync(join(packageRoot, "src", "components", "index.ts"), "utf8");
    const galleryPath = join(repoRoot, "my-app", "src", "pages", "charts.tsx");
    const gallery = existsSync(galleryPath) ? readFileSync(galleryPath, "utf8") : undefined;

    for (const [chartName, exampleFile] of contractCharts) {
      const importName = `${chartName}Example`;
      const importPath = exampleFile.replace(".tsx", "");

      expect(exportsFile).toContain(`export { ${chartName} }`);
      expect(docs).toContain(`### ${chartName}`);
      expect(docs).toContain(`../my-app/src/components/${exampleFile}`);

      if (gallery) {
        expect(existsSync(join(repoRoot, "my-app", "src", "components", exampleFile))).toBe(true);
        expect(gallery).toContain(`data-chart-contract="${chartName}"`);
        expect(gallery).toContain(`import ${importName} from '../components/${importPath}'`);
        expect(gallery).toContain(`<${importName} `);
      }
    }
  });

  it("should documents public data color fields with exported prop names", () => {
    const docs = readFileSync(join(__dirname, "..", "CHARTING.md"), "utf8");

    for (const chartName of [
      "AreaChart",
      "BarChart",
      "LineChart",
      "StackedBarChart",
      "Sparkline",
      "Heatmap",
      "FlameGraph",
    ]) {
      const section = getChartSection(docs, chartName);

      expect(section).toContain("color");
      expect(section).not.toContain("accentColor");
    }

    const timelineSection = getChartSection(docs, "Timeline");

    expect(timelineSection).toContain("accentColor");
    expect(timelineSection).not.toContain("valueFormatter");
  });
});

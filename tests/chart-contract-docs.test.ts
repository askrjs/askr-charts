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

describe("chart contract documentation", () => {
  it("keeps package docs, exports, and the app gallery aligned", () => {
    const packageRoot = join(__dirname, "..");
    const repoRoot = join(packageRoot, "..");
    const docs = readFileSync(join(packageRoot, "CHARTING.md"), "utf8");
    const exportsFile = readFileSync(join(packageRoot, "src", "components", "index.ts"), "utf8");
    const gallery = readFileSync(join(repoRoot, "my-app", "src", "pages", "charts.tsx"), "utf8");

    for (const [chartName, exampleFile] of contractCharts) {
      const importName = `${chartName}Example`;
      const importPath = exampleFile.replace(".tsx", "");

      expect(exportsFile).toContain(`export { ${chartName} }`);
      expect(docs).toContain(`### ${chartName}`);
      expect(docs).toContain(`../my-app/src/components/${exampleFile}`);
      expect(
        existsSync(join(repoRoot, "my-app", "src", "components", exampleFile)),
      ).toBe(true);
      expect(gallery).toContain(`data-chart-contract="${chartName}"`);
      expect(gallery).toContain(`import ${importName} from '../components/${importPath}'`);
      expect(gallery).toContain(`<${importName} `);
    }
  });
});

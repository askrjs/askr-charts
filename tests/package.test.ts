import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import * as publicApi from "../src/index";

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly exports: Readonly<Record<string, unknown>>;
  readonly scripts: Readonly<Record<string, string>>;
}

const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
const manifest = JSON.parse(readFileSync(packagePath, "utf8")) as PackageManifest;

describe("package exports", () => {
  it("should expose only root JavaScript styles and metadata given the clean-break manifest when resolving", () => {
    expect(manifest.name).toBe("@askrjs/charts");
    expect(manifest.version).toBe("0.1.0");
    expect(manifest.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
      "./styles": "./dist/styles.css",
      "./package.json": "./package.json",
    });

    expect(import.meta.resolve("@askrjs/charts")).toMatch(/\/dist\/index\.js$/);
    expect(import.meta.resolve("@askrjs/charts/styles")).toMatch(/\/dist\/styles\.css$/);
    expect(import.meta.resolve("@askrjs/charts/package.json")).toMatch(/\/package\.json$/);
  });

  it("should reject every legacy package family given removed subpaths when resolving", () => {
    const legacySubpaths = [
      "components",
      "core",
      "default",
      "default/bar-chart.css",
      "default/line-chart.css",
      "default/pie-chart.css",
      "default/progress-meter.css",
      "default/tokens.css",
      "templates/chart",
    ];

    for (const subpath of legacySubpaths) {
      expect(() => import.meta.resolve(`@askrjs/charts/${subpath}`)).toThrow(
        /Package subpath .* is not defined by "exports"/,
      );
    }
    expect(manifest.scripts).not.toHaveProperty("new:chart");
  });

  it("should expose only plotting functions given the root module when inspecting runtime names", () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        "appendPlotRows",
        "bin",
        "constant",
        "count",
        "createPlot",
        "filterRows",
        "group",
        "mean",
        "movingAverage",
        "movingWindow",
        "normalize",
        "partition",
        "regression",
        "removePlotRows",
        "sortRows",
        "stack",
        "sum",
        "trimPlotRows",
        "upsertPlotRows",
      ].sort(),
    );

    for (const legacyName of [
      "AreaChart",
      "BarChart",
      "ChartLegend",
      "ChartPanel",
      "ChartShell",
      "DonutChart",
      "FlameGraph",
      "Heatmap",
      "LineChart",
      "PieChart",
      "ProgressMeter",
      "RadialGauge",
      "Sparkline",
      "StackedBarChart",
      "Timeline",
    ]) {
      expect(publicApi).not.toHaveProperty(legacyName);
    }
  });
});

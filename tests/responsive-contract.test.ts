import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const packageRoot = join(__dirname, "..");
const responsiveContractCharts = ["default"] as const;
const defaultPatternImports = [
  "./styles/base/animations.css",
  "./styles/layout/layout.css",
  "./styles/layout/responsive-layout.css",
  "./styles/display/chart.css",
  "./styles/display/bar-chart.css",
  "./styles/display/donut-chart.css",
  "./styles/display/heatmap.css",
  "./styles/display/progress-meter.css",
  "./styles/display/sparkline.css",
  "./styles/display/stacked-bar-chart.css",
  "./styles/display/timeline.css",
  "./styles/display/legend.css",
  "./styles/data/series.css",
  "./styles/overlays/tooltip.css",
];

function read(relativePath: string) {
  return readFileSync(join(packageRoot, relativePath), "utf8");
}

describe("responsive chart contract", () => {
  it("keeps responsive layout assets, imports, and docs aligned", () => {
    const defaultResponsive = read("src/charts/default/styles/layout/responsive-layout.css");
    const defaultLayout = read("src/charts/default/styles/layout/layout.css");
    const templateResponsive = read("templates/chart/styles/layout/responsive-layout.css");
    const templateLayout = read("templates/chart/styles/layout/layout.css");
    const charting = read("CHARTING.md");

    const responsiveImportPattern =
      /@import\s+['"]\.\/styles\/layout\/responsive-layout\.css['"];?/;
    for (const chart of responsiveContractCharts) {
      const indexCss = read(`src/charts/${chart}/index.css`);
      expect(indexCss).toMatch(responsiveImportPattern);

      const responsiveCss = read(`src/charts/${chart}/styles/layout/responsive-layout.css`);
      expect(responsiveCss).toBe(defaultResponsive);
    }

    const templateIndex = read("templates/chart/index.css");
    expect(templateIndex).toMatch(responsiveImportPattern);

    const defaultIndex = read("src/charts/default/index.css");
    for (const requiredImport of defaultPatternImports) {
      expect(defaultIndex).toContain(requiredImport);
      expect(templateIndex).toContain(requiredImport);
    }

    const requiredResponsiveSnippets = [
      ':where(.chart-shell, [data-slot="chart-shell"])',
      ':where(.chart-panel, [data-slot="chart-panel"])',
      "@media (min-width: 48rem)",
      "@media (min-width: 64rem)",
    ];

    const requiredLayoutSnippets = [
      ':where(.chart-shell, [data-slot="chart-shell"])',
      ':where(.chart-panel, [data-slot="chart-panel"])',
      ':where(.chart-shell-content, [data-slot="chart-shell-content"])',
      "--ak-chart-gap",
      "--ak-chart-padding",
    ];

    const normalizedResponsive = defaultResponsive.replace(/'/g, '"');
    const normalizedLayout = defaultLayout.replace(/'/g, '"');

    for (const snippet of requiredResponsiveSnippets) {
      expect(normalizedResponsive).toContain(snippet);
    }

    for (const snippet of requiredLayoutSnippets) {
      expect(normalizedLayout).toContain(snippet);
    }

    expect(templateResponsive).toBe(defaultResponsive);
    expect(templateLayout).toBe(defaultLayout);

    const requiredDocs = [
      "Build chart shells mobile first.",
      "Use `data-slot` hooks",
      "Keep selectors low-specificity",
      "`48rem` and `64rem`",
      "`--ak-chart-color-primary`",
    ];

    for (const snippet of requiredDocs) {
      expect(charting).toContain(snippet);
    }
  });
});

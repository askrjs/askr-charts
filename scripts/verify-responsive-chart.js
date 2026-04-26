import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const responsiveContractCharts = ["default"];
const defaultPatternImports = [
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

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function main() {
  const defaultResponsive = await read("src/charts/default/styles/layout/responsive-layout.css");
  const defaultLayout = await read("src/charts/default/styles/layout/layout.css");
  const templateResponsive = await read("templates/chart/styles/layout/responsive-layout.css");
  const templateLayout = await read("templates/chart/styles/layout/layout.css");
  const charting = await read("CHARTING.md");

  const responsiveImportPattern = /@import\s+['"]\.\/styles\/layout\/responsive-layout\.css['"];?/;
  for (const chart of responsiveContractCharts) {
    const indexCss = await read(`src/charts/${chart}/index.css`);
    if (!responsiveImportPattern.test(indexCss)) {
      throw new Error(`${chart} chart is missing responsive-layout.css import.`);
    }

    const responsiveCss = await read(`src/charts/${chart}/styles/layout/responsive-layout.css`);
    if (responsiveCss !== defaultResponsive) {
      throw new Error(`${chart} responsive layout CSS is out of sync with default.`);
    }
  }

  const templateIndex = await read("templates/chart/index.css");
  if (!responsiveImportPattern.test(templateIndex)) {
    throw new Error("Chart template is missing responsive-layout.css import.");
  }

  const defaultIndex = await read("src/charts/default/index.css");
  for (const requiredImport of defaultPatternImports) {
    if (!defaultIndex.includes(requiredImport)) {
      throw new Error(`Default chart package is missing required import: ${requiredImport}`);
    }

    if (!templateIndex.includes(requiredImport)) {
      throw new Error(`Chart template is missing required import: ${requiredImport}`);
    }
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
    if (!normalizedResponsive.includes(snippet)) {
      throw new Error(`Default responsive chart CSS is missing: ${snippet}`);
    }
  }

  for (const snippet of requiredLayoutSnippets) {
    if (!normalizedLayout.includes(snippet)) {
      throw new Error(`Default chart layout CSS is missing: ${snippet}`);
    }
  }

  if (defaultResponsive !== templateResponsive) {
    throw new Error("Template responsive chart CSS is out of sync with the default chart package.");
  }

  if (defaultLayout !== templateLayout) {
    throw new Error("Template chart layout CSS is out of sync with the default chart package.");
  }

  const requiredDocs = [
    "Build chart shells mobile first.",
    "Use `data-slot` hooks",
    "Keep selectors low-specificity",
    "`48rem` and `64rem`",
    "`--ak-chart-color-primary`",
  ];

  for (const snippet of requiredDocs) {
    if (!charting.includes(snippet)) {
      throw new Error(`CHARTING.md is missing responsive guidance: ${snippet}`);
    }
  }

  console.log("Responsive chart contract verified.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

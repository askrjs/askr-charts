import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const officialCharts = ["default"];

const requiredRootTokens = [
  "--ak-chart-font-size",
  "--ak-chart-font-family",
  "--ak-chart-font-family-mono",
  "--ak-chart-radius",
  "--ak-chart-gap",
  "--ak-chart-padding",
  "--ak-chart-series-1",
  "--ak-chart-series-2",
  "--ak-chart-series-3",
  "--ak-chart-series-4",
  "--ak-chart-series-5",
  "--ak-chart-series-6",
];

const requiredSurfaceTokens = [
  "--ak-chart-color-primary",
  "--ak-chart-color-muted",
  "--ak-chart-color-surface",
  "--ak-chart-color-border",
  "--ak-chart-color-text",
  "--ak-chart-color-text-muted",
  "--ak-chart-color-tooltip-bg",
  "--ak-chart-color-tooltip-fg",
  "--ak-chart-bg",
  "--ak-chart-surface",
  "--ak-chart-surface-elevated",
  "--ak-chart-border",
  "--ak-chart-text",
  "--ak-chart-text-muted",
  "--ak-chart-grid",
  "--ak-chart-axis",
  "--ak-chart-tooltip-bg",
  "--ak-chart-tooltip-fg",
  "--ak-chart-shadow",
];

function parseBlocks(css) {
  const blocks = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/gms;
  let match;

  while ((match = pattern.exec(css))) {
    const selectors = match[1]
      .split(",")
      .map((selector) => selector.replace(/\/\*[\s\S]*?\*\//g, "").trim())
      .filter(Boolean);

    blocks.push({ selectors, body: match[2] });
  }

  return blocks;
}

function tokensFromBlocks(css, selectorPredicate) {
  const tokens = new Set();
  const blocks = parseBlocks(css);

  for (const block of blocks) {
    if (!block.selectors.some(selectorPredicate)) {
      continue;
    }

    for (const match of block.body.matchAll(/(--ak-chart-[a-z0-9-]+)\s*:/g)) {
      tokens.add(match[1]);
    }
  }

  return tokens;
}

function isLightSelector(selector) {
  return /\[data-theme=(['"])light\1\]/.test(selector);
}

function isDarkSelector(selector) {
  return /\[data-theme=(['"])dark\1\]/.test(selector);
}

function isRootSelector(selector) {
  return selector === ":root";
}

function difference(source, target) {
  return [...source].filter((token) => !target.has(token));
}

function assertNoMissing(missing, message) {
  if (missing.length > 0) {
    throw new Error(`${message}: ${missing.join(", ")}`);
  }
}

async function readChartTokens(chart) {
  const tokensPath = path.join(root, "src", "charts", chart, "tokens.css");
  return readFile(tokensPath, "utf8");
}

async function main() {
  const defaultCss = await readChartTokens("default");
  const defaultRootTokens = tokensFromBlocks(defaultCss, isRootSelector);

  for (const chart of officialCharts) {
    const css = await readChartTokens(chart);
    const rootTokens = tokensFromBlocks(css, isRootSelector);
    const lightTokens = tokensFromBlocks(css, isLightSelector);
    const darkTokens = tokensFromBlocks(css, isDarkSelector);

    assertNoMissing(
      requiredRootTokens.filter((token) => !rootTokens.has(token)),
      `${chart} is missing required root tokens`,
    );

    assertNoMissing(
      requiredSurfaceTokens.filter((token) => !lightTokens.has(token)),
      `${chart} is missing required light surface tokens`,
    );

    assertNoMissing(
      requiredSurfaceTokens.filter((token) => !darkTokens.has(token)),
      `${chart} is missing required dark surface tokens`,
    );

    assertNoMissing(difference(lightTokens, darkTokens), `${chart} has light-only chart tokens`);

    assertNoMissing(difference(darkTokens, lightTokens), `${chart} has dark-only chart tokens`);

    assertNoMissing(
      difference(defaultRootTokens, rootTokens),
      `${chart} is missing root contract tokens present in default`,
    );

    assertNoMissing(
      difference(rootTokens, defaultRootTokens),
      `${chart} has extra root contract tokens not present in default`,
    );
  }

  console.log("Chart token contract verified.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

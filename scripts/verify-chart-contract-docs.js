#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const repoRoot = join(packageRoot, "..");

const contractCharts = [
  { name: "AreaChart", example: "area-chart-example.tsx" },
  { name: "BarChart", example: "bar-chart-example.tsx" },
  { name: "LineChart", example: "line-chart-example.tsx" },
  { name: "DonutChart", example: "donut-chart-example.tsx" },
  { name: "StackedBarChart", example: "stacked-bar-chart-example.tsx" },
  { name: "Sparkline", example: "sparkline-example.tsx" },
  { name: "Heatmap", example: "heatmap-example.tsx" },
  { name: "Timeline", example: "timeline-example.tsx" },
  { name: "FlameGraph", example: "flame-graph-example.tsx" },
  { name: "ProgressMeter", example: "progress-meter-example.tsx" },
  { name: "RadialGauge", example: "radial-gauge-example.tsx" },
];

const supportPrimitives = ["ChartShell", "ChartPanel", "ChartLegend", "ChartEmptyState"];

const docsPath = join(packageRoot, "CHARTING.md");
const exportsPath = join(packageRoot, "src", "components", "index.ts");
const galleryPath = join(repoRoot, "my-app", "src", "pages", "charts.tsx");
const examplesRoot = join(repoRoot, "my-app", "src", "components");

const docs = readFileSync(docsPath, "utf8");
const exportsFile = readFileSync(exportsPath, "utf8");
const gallery = readFileSync(galleryPath, "utf8");

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

for (const chart of contractCharts) {
  const examplePath = join(examplesRoot, chart.example);
  const importName = `${chart.name}Example`;
  const importPath = chart.example.replace(".tsx", "");

  assert(
    exportsFile.includes(`export { ${chart.name} }`) ||
      exportsFile.includes(`export { ${chart.name} `),
    `${chart.name} must be exported from src/components/index.ts`,
  );
  assert(docs.includes(`### ${chart.name}`), `${chart.name} must have a docs section`);
  assert(
    docs.includes(`../my-app/src/components/${chart.example}`),
    `${chart.name} docs must link to ${chart.example}`,
  );
  assert(existsSync(examplePath), `${chart.name} must have ${chart.example}`);
  assert(
    gallery.includes(`import ${importName} from '../components/${importPath}'`),
    `${chart.name} example must be imported by my-app/src/pages/charts.tsx`,
  );
  assert(
    gallery.includes(`data-chart-contract="${chart.name}"`),
    `${chart.name} gallery section must expose data-chart-contract="${chart.name}"`,
  );
  assert(
    gallery.includes(`<${importName} `),
    `${chart.name} example must be rendered by my-app/src/pages/charts.tsx`,
  );
}

for (const primitive of supportPrimitives) {
  assert(
    docs.includes(`\`${primitive}\``),
    `${primitive} must be documented as a supporting primitive`,
  );
  assert(
    exportsFile.includes(`export { ${primitive} }`) ||
      exportsFile.includes(`export { ${primitive} `),
    `${primitive} must remain exported from src/components/index.ts`,
  );
}

if (failures.length > 0) {
  console.error("Chart contract documentation verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Chart contract documentation verification passed.");

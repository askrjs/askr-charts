import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chartsRoot = path.resolve(__dirname, "..");

const CHART_COMPONENTS_DIR = path.join(chartsRoot, "src", "components");
const CHART_STYLE_DIR = path.join(chartsRoot, "src", "charts", "default", "styles");
const ALLOWED_STYLE_ONLY_SLOTS = new Set([
  "bar-chart-fill",
  "bar-chart-label",
  "bar-chart-list",
  "bar-chart-track",
  "bar-chart-value",
  "chart-divider",
  "chart-frame",
  "chart-graphic",
  "chart-muted",
  "chart-series",
  "chart-series-bar",
  "chart-series-dot",
  "chart-surface",
  "chart-tooltip",
  "donut-chart-center",
  "donut-chart-item",
  "donut-chart-label",
  "donut-chart-list",
  "donut-chart-ring",
  "donut-chart-swatch",
  "donut-chart-total-label",
  "donut-chart-total-value",
  "donut-chart-value",
  "heatmap-column-label",
  "heatmap-corner",
  "heatmap-grid",
  "heatmap-row-label",
  "progress-meter-description",
  "progress-meter-fill",
  "progress-meter-header",
  "progress-meter-label",
  "progress-meter-track",
  "progress-meter-value",
  "sparkline-dot",
  "sparkline-item",
  "sparkline-list",
  "sparkline-stem",
  "stacked-bar-chart-item",
  "stacked-bar-chart-label",
  "stacked-bar-chart-list",
  "stacked-bar-chart-segment",
  "stacked-bar-chart-track",
  "stacked-bar-chart-value",
  "timeline-content",
  "timeline-description",
  "timeline-header",
  "timeline-item",
  "timeline-label",
  "timeline-list",
  "timeline-marker",
  "timeline-value",
]);

function walkFiles(dirPath, extensions) {
  const normalizedExtensions = Array.isArray(extensions) ? extensions : [extensions];
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, normalizedExtensions));
    } else if (normalizedExtensions.some((extension) => entry.name.endsWith(extension))) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractComponentSlots() {
  const slots = new Set();
  const files = walkFiles(CHART_COMPONENTS_DIR, [".ts", ".tsx"]);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const patterns = [/['"]data-slot['"]\s*:\s*['"]([^'"]+)['"]/g, /data-slot="([^"]+)"/g];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content))) {
        slots.add(match[1]);
      }
    }
  }

  return slots;
}

function extractStyleSlots() {
  const slots = new Set();
  const files = walkFiles(CHART_STYLE_DIR, ".css");

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const pattern = /\[data-slot=['"]([^'"]+)['"]\]/g;
    let match;
    while ((match = pattern.exec(content))) {
      slots.add(match[1]);
    }
  }

  return slots;
}

function run() {
  const componentSlots = extractComponentSlots();
  const styleSlots = extractStyleSlots();

  const uncovered = [...componentSlots].filter((slot) => !styleSlots.has(slot)).sort();
  const styleOnly = [...styleSlots]
    .filter((slot) => !componentSlots.has(slot) && !ALLOWED_STYLE_ONLY_SLOTS.has(slot))
    .sort();

  console.log(`Component slots: ${componentSlots.size}`);
  console.log(`Style slots:     ${styleSlots.size}`);
  console.log(`Uncovered:       ${uncovered.length}`);
  console.log(`Style-only:      ${styleOnly.length}`);

  if (uncovered.length > 0) {
    console.log("\nUncovered slots (in components but not in styles):");
    for (const slot of uncovered) {
      console.log(`  - ${slot}`);
    }
  }

  if (styleOnly.length > 0) {
    console.log("\nStyle-only slots (in styles but not in components):");
    for (const slot of styleOnly) {
      console.log(`  - ${slot}`);
    }
  }

  if (uncovered.length > 0 || styleOnly.length > 0) {
    process.exitCode = 1;
  }
}

run();

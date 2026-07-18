import type { JSXElement } from "@askrjs/askr/jsx-runtime";
import { LiveInteractionsExport } from "./live-interactions-export";
import { MarkFamilies } from "./mark-families";
import { MixedHistogramTrend } from "./mixed-histogram-trend";
import { CatalogRecipes } from "./catalog-recipes";

export const visualPrimitiveCoverage = Object.freeze([
  "Root", "Scale", "Axis", "Grid", "Bar", "Line", "Area", "Point", "Arc", "Cell",
  "Rect", "Rule", "Text", "Legend", "Tooltip", "Crosshair", "Select", "Zoom", "Brush",
] as const);

export const visualScaleCoverage = Object.freeze([
  "band", "point", "linear", "power", "log", "symlog", "time", "utc", "ordinal-color",
  "continuous-color",
] as const);

export const visualRecipeCoverage = Object.freeze([
  "line", "area", "sparkline", "vertical-bars", "horizontal-bars", "grouped-bars",
  "stacked-bars", "histogram-trend", "scatter", "bubble", "pie", "donut", "gauge",
  "heatmap", "flame-graph", "timeline", "progress", "live-data", "mixed-dual-axis",
] as const);

export interface VisualCatalogCase {
  readonly id: string;
  readonly title: string;
  readonly recipes: readonly (typeof visualRecipeCoverage)[number][];
  readonly primitives: readonly (typeof visualPrimitiveCoverage)[number][];
  readonly scales: readonly (typeof visualScaleCoverage)[number][];
  readonly render: () => JSXElement;
}

function catalogCase(entry: VisualCatalogCase): VisualCatalogCase {
  return Object.freeze(entry);
}

export const visualCatalog: readonly VisualCatalogCase[] = Object.freeze([
  catalogCase({
    id: "mark-families",
    title: "Mark families and operational recipes",
    recipes: Object.freeze([
      "line", "area", "vertical-bars", "horizontal-bars", "scatter", "bubble", "donut", "gauge", "heatmap",
      "flame-graph", "timeline", "progress",
    ]),
    primitives: Object.freeze(["Root", "Bar", "Line", "Area", "Point", "Arc", "Cell", "Rect", "Rule", "Text", "Legend", "Tooltip"]),
    scales: Object.freeze(["band", "linear", "time", "ordinal-color", "continuous-color"]),
    render: MarkFamilies,
  }),
  catalogCase({
    id: "recipe-coverage",
    title: "Grouped, stacked, compact, nonlinear, and color recipes",
    recipes: Object.freeze(["sparkline", "grouped-bars", "stacked-bars", "scatter", "bubble", "pie"]),
    primitives: Object.freeze(["Root", "Scale", "Axis", "Grid", "Bar", "Line", "Area", "Point", "Arc", "Cell", "Legend", "Tooltip"]),
    scales: Object.freeze(["band", "point", "linear", "power", "log", "symlog", "ordinal-color", "continuous-color"]),
    render: CatalogRecipes,
  }),
  catalogCase({
    id: "histogram-trend",
    title: "Histogram, trend, and dual axes",
    recipes: Object.freeze(["histogram-trend", "mixed-dual-axis"]),
    primitives: Object.freeze(["Root", "Scale", "Axis", "Grid", "Bar", "Line", "Legend", "Tooltip"]),
    scales: Object.freeze(["utc", "linear", "symlog", "ordinal-color"]),
    render: MixedHistogramTrend,
  }),
  catalogCase({
    id: "live-interactions",
    title: "Live data, inspection, selection, gestures, and export",
    recipes: Object.freeze(["live-data"]),
    primitives: Object.freeze(["Root", "Line", "Point", "Legend", "Tooltip", "Crosshair", "Select", "Zoom", "Brush"]),
    scales: Object.freeze(["time", "linear"]),
    render: LiveInteractionsExport,
  }),
]);

export function VisualCatalog() {
  return (
    <main className="ak-visual-lab" data-slot="visual-catalog" data-testid="visual-catalog">
      <header className="ak-visual-lab-header">
        <p className="ak-visual-lab-kicker">@askrjs/charts</p>
        <h1>Visual acceptance lab</h1>
        <p>Persistent, package-owned coverage for primitives, recipes, themes, and responsive frames.</p>
      </header>
      {visualCatalog.map((entry) => (
        <section key={entry.id} data-visual-case={entry.id} data-testid={`visual-${entry.id}`} className="ak-visual-case">
          <h2>{entry.title}</h2>
          <entry.render />
        </section>
      ))}
    </main>
  );
}

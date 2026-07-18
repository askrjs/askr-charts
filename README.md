# @askrjs/charts

Typed Canvas 2D plots for Askr applications, with the same immutable scene available for SVG and data export.

Version 0.1 is a clean break from the old CSS-first chart catalog. JavaScript comes from `@askrjs/charts`; structural and theme-token styles come from `@askrjs/charts/styles`. There are no component, core, default, per-chart CSS, template, or generator compatibility entrypoints.

## Install

```bash
npm install @askrjs/charts
```

Import the styles once at the application boundary:

```css
@import "@askrjs/charts/styles";
```

## Quick start

Create a typed plot namespace once at module scope, then compose marks inside its root:

```tsx
import { createPlot } from "@askrjs/charts";

type RevenueRow = {
  id: string;
  day: Date;
  revenue: number;
  target: number;
};

const RevenuePlot = createPlot<RevenueRow>();

const revenue: readonly RevenueRow[] = [
  { id: "mon", day: new Date("2026-07-13T00:00:00Z"), revenue: 42, target: 48 },
  { id: "tue", day: new Date("2026-07-14T00:00:00Z"), revenue: 58, target: 50 },
  { id: "wed", day: new Date("2026-07-15T00:00:00Z"), revenue: 51, target: 52 },
];

export function RevenueTrend() {
  return (
    <RevenuePlot.Root
      data={revenue}
      rowKey="id"
      label="Daily revenue"
      title="Revenue"
      description="Actual revenue and target for the current week."
    >
      <RevenuePlot.Bar x="day" y="revenue" />
      <RevenuePlot.Line x="day" y="target" />
      <RevenuePlot.Point x="day" y="target" />
    </RevenuePlot.Root>
  );
}
```

`Row` drives field-name inference. A numeric mark channel cannot name a string field, and a factory's primitives cannot be mixed into another factory's root. Fields, accessors, and expressions can be combined without giving up row typing.

## Public surface

`createPlot<Row>()` returns a stable namespace containing:

- structure: `Root`, `Scale`, `Axis`, `Grid`
- marks: `Bar`, `Line`, `Area`, `Point`, `Arc`, `Cell`, `Rect`, `Rule`, `Text`
- interaction: `Legend`, `Tooltip`, `Crosshair`, `Select`, `Zoom`, `Brush`

The root owns responsive sizing, semantic labels, title and description, empty and summary states, controlled or uncontrolled view and selection, follow-latest behavior, activation, and export access through `onApiChange`.

Useful defaults are inferred from channels and mark context:

- numbers use linear scales
- `Date` values use local-time scales
- categorical positions use band or point scales
- categorical colors use ordinal scales; numeric colors use continuous scales
- Cartesian marks receive default axes and tooltip behavior

Add explicit scale, axis, grid, legend, or tooltip children when the composition needs different behavior. Named scales support mixed plots and dual axes.

`Tooltip` supports nearest-mark inspection and shared nearest-x inspection with `mode="mark" | "x"`; `auto` chooses shared x for compatible Cartesian marks. Add `Select` for click/tap and Enter/Space selection. Its `single` default replaces the selection, while `toggle` adds or removes source keys. Selection updates before the additive `onActivate(row, key, target)` callback.

Mounted plots always respond to their container. `width` is the SSR and initial-layout fallback, not a fixed browser width; use a sized container for a fixed mounted chart.

## Data rules

- Signed finite numbers stay signed; negative values are not clamped to zero.
- `null`, `undefined`, invalid dates, and non-finite numbers are missing values, not zero.
- Log scales omit zero and negative values.
- `diagnostics` opts into omitted-value warnings, and `summary` receives `omittedRowCount` for accessible reporting.
- Stable row keys drive selection retention, transitions, and live updates.
- Use `constant("...")` for a literal string channel. Bare strings identify row fields.

## Migration from the old catalog

There are no compatibility wrappers in 0.1.

| Removed 0.0 surface                         | 0.1 composition                                                   |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `ChartShell`                                | `Plot.Root`; keep product card or page chrome in the app          |
| `ChartPanel`                                | App-owned card/section plus `Plot.Root` title and description     |
| `ChartEmptyState`                           | `Root empty="..."`; keep loading and error ownership in the route |
| `ChartLegend`                               | `Plot.Legend`                                                     |
| `AreaChart`                                 | `Plot.Area`                                                       |
| `BarChart`                                  | `Plot.Bar`                                                        |
| `LineChart`                                 | `Plot.Line`, optionally with `Plot.Point`                         |
| `DonutChart`                                | `Plot.Arc` with `innerRadius`                                     |
| `PieChart`                                  | `Plot.Arc` with `innerRadius={0}`                                 |
| `StackedBarChart`                           | `Plot.Bar stack="series"`; use `normalize` for percent stacks     |
| `Sparkline`                                 | Compact `Plot.Root` with `Plot.Line` or `Plot.Area`               |
| `Heatmap`                                   | `Plot.Cell`                                                       |
| `Timeline`                                  | `Plot.Rule`, `Plot.Point`, and `Plot.Text`                        |
| `FlameGraph`                                | `Plot.Rect` with `partition(...)`                                 |
| `ProgressMeter`                             | Bounded `Plot.Bar` plus `Root meter={{ role: "meter", ... }}`     |
| `RadialGauge`                               | Bounded `Plot.Arc` plus `Root meter={{ role: "meter", ... }}`     |
| `@askrjs/charts/core`                       | Helpers exported directly from `@askrjs/charts`                   |
| `@askrjs/charts/default` or root CSS import | `@askrjs/charts/styles`                                           |
| Per-chart CSS, templates, and `new:chart`   | One structural stylesheet and primitive composition               |

## More

- [Charting contract](./CHARTING.md)
- [Architecture and defaults](./docs/overview.md)
- [Usage recipes](./docs/usage.md)
- [Mixed histogram and trend](./examples/mixed-histogram-trend.tsx)
- [All mark families](./examples/mark-families.tsx)
- [Live data, interactions, and export](./examples/live-interactions-export.tsx)

`@askrjs/themes` is optional. The stylesheet defines self-contained `--ak-chart-*` tokens and uses compatible Askr theme tokens when they are present.

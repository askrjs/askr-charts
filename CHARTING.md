# Charting contract

`@askrjs/charts` 0.1 is a typed plotting engine for Askr product interfaces. A plot is compiled from JSX descriptors into one immutable scene. The mounted renderer paints that scene to Canvas 2D, while PNG, SVG, and data exports read the same resolved scene.

The visible renderer is Canvas 2D. SVG is an export format, not a mounted renderer or a graphical SSR fallback.

## Package boundary

```tsx
import { createPlot, movingAverage } from "@askrjs/charts";
import "@askrjs/charts/styles";
```

- Import JavaScript and public types from `@askrjs/charts`.
- Import styles once from `@askrjs/charts/styles`.
- Do not import `components`, `core`, `default`, per-chart CSS, templates, or generator paths; they were removed without compatibility wrappers.
- Keep product card, page, loading, and error composition in the application. The plot owns plotting semantics and interaction state.

## Factory and child contract

Create a namespace once per row contract, at module scope:

```tsx
type MetricRow = { id: string; at: Date; value: number };

const MetricPlot = createPlot<MetricRow>();
```

The returned namespace is stable and factory-bound. A root accepts its own primitives, fragments, arrays, getters without arguments, and conditional `null` or boolean children. It rejects DOM nodes, arbitrary components, text children, circular child structures, and primitives created by another `createPlot()` call.

## Root

`Root` requires `data`, `rowKey`, and `label`.

| Prop                                   | Contract                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `data`                                 | `readonly Row[]` or a reactive `() => readonly Row[]` getter                      |
| `rowKey`                               | A row field or `(row, index) => string \| number`; keys must be unique and finite |
| `label`                                | Required accessible name for the plot                                             |
| `title`, `headingLevel`, `description` | Visible semantic heading, configurable level, and supporting text                 |
| `summary`                              | Text or a callback receiving source, transformed, omitted, and visible counts     |
| `empty`                                | Empty-state message when no renderable rows remain                                |
| `width`, `height`                      | SSR/initial fallbacks; mounted width responds to its container                     |
| `class`, `style`, `id`                 | Structural application hooks                                                      |
| `meter`                                | `{ role: "meter", min, max, value, valueText? }` for bounded bars and arcs        |
| `view`, `onViewChange`                 | Controlled visible x/y domains                                                    |
| `defaultView`                          | Initial uncontrolled visible domains                                              |
| `selection`, `onSelectionChange`       | Controlled selection as stable row keys                                           |
| `defaultSelection`                     | Initial uncontrolled selection                                                    |
| `onActivate`                           | Drill-down callback receiving row, key, and immutable interaction target           |
| `followLatest`                         | Row-count or time window for live plots                                           |
| `onApiChange`                          | Callback receiving `PlotApi<Row>` after mount and `null` after cleanup            |
| `locale`                               | Locale used by inferred formatting                                                |
| `diagnostics`                          | Enable development diagnostics for omitted or invalid values                      |

Summary callbacks can keep accessibility truthful when data is omitted:

```tsx
<MetricPlot.Root
  data={rows}
  rowKey="id"
  label="Request latency"
  diagnostics
  summary={({ visibleRowCount, omittedRowCount }) =>
    `${visibleRowCount} visible points; ${omittedRowCount} rows omitted.`
  }
>
  <MetricPlot.Line x="at" y="value" />
</MetricPlot.Root>
```

## Channels and expressions

A channel accepts one of three forms:

1. a typed row field name;
2. an accessor `(row, index) => value | null | undefined`;
3. a channel expression.

```tsx
<MetricPlot.Point x="at" y={(row) => row.value / 1_000} title={(row) => `${row.value} µs`} />
```

Bare strings always identify row fields. Wrap a literal string in `constant(...)` so a color, label, or other channel is not mistaken for a field:

```tsx
import { constant } from "@askrjs/charts";

<MetricPlot.Line x="at" y="value" stroke={constant("#2563eb")} />;
```

The expression helpers are immutable descriptors:

| Helper                          | Purpose                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `constant(value)`               | Encode a literal channel value, especially a literal string                       |
| `bin(input, options?)`          | Bin a numeric or `Date` channel by thresholds, interval, or explicit domain       |
| `count()`                       | Count rows in the current bin or group                                            |
| `sum(input)`                    | Sum finite numeric values in the current bin or group                             |
| `mean(input)`                   | Average finite numeric values in the current bin or group                         |
| `group(input)`                  | Declare the grouping channel for a compound aggregate                             |
| `stack(input, options?)`        | Stack a numeric channel with zero, diverging, or expand offset and a stable order |
| `normalize(input)`              | Normalize a numeric channel to proportional values                                |
| `movingWindow(input, options)`  | Rolling `sum`, `mean`, `min`, or `max`; choose window size and partial behavior   |
| `movingAverage(input, options)` | Rolling mean shorthand                                                            |
| `regression(input, options?)`   | Linear regression over row index or an explicit x channel                         |

The reference histogram/trend composition uses typed fields and expressions together:

```tsx
<LatencyPlot.Bar
  x={bin("latencyMs", { thresholds: 20 })}
  y={count()}
  fill="outcome"
  stack="outcome"
/>
<LatencyPlot.Line x="timestamp" y={movingAverage("p95", { window: 7 })} />
<LatencyPlot.Point x="timestamp" y="p95" />
```

`Bar.stack` and `Area.stack` select the categorical series field. Their `normalize` shorthand produces proportional stacks. The `stack(...)` and `normalize(...)` channel expressions are useful when the numeric channel itself is composed explicitly.

## Row transforms and immutable updates

Mark-level transforms run before layout and do not mutate source rows:

| Helper                                                     | Purpose                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `filterRows(predicate)`                                    | Keep rows matching a typed predicate                          |
| `sortRows({ by, direction? })`                             | Stable ascending or descending sort by field/accessor         |
| `partition({ id, parentId?, children?, value, padding? })` | Convert flat-parent or nested hierarchy into rectangle layout |

```tsx
<MetricPlot.Line
  transform={[
    filterRows<MetricRow>((row) => row.value >= 0),
    sortRows<MetricRow>({ by: "at", direction: "ascending" }),
  ]}
  x="at"
  y="value"
/>
```

Use the pure update helpers for live arrays:

| Helper                                  | Behavior                                                       |
| --------------------------------------- | -------------------------------------------------------------- |
| `appendPlotRows(rows, additions)`       | Append one or many rows                                        |
| `upsertPlotRows(rows, updates, rowKey)` | Replace matching keys and append new keys; rejects duplicates  |
| `removePlotRows(rows, keys, rowKey)`    | Remove stable keys; a predicate form does not require `rowKey` |
| `trimPlotRows(rows, countOrWindow)`     | Retain the latest row count or a `Date`-field time window      |

Unchanged operations may return the original array; changed results are frozen.

## Scales and defaults

When scales are not declared, the compiler infers useful defaults from channel values and mark context:

- numeric positions: `linear`
- `Date` positions: local `time`
- categorical bar/cell positions: `band`
- categorical line/area/point positions: `point`
- categorical color: `ordinal-color`
- numeric or temporal color: `continuous-color`

Cartesian marks also receive default axes and tooltip behavior. Explicit `Scale`, `Axis`, `Grid`, `Legend`, or `Tooltip` children replace the corresponding inferred choice.

Supported scale types are:

| Type               | Important options                                                        |
| ------------------ | ------------------------------------------------------------------------ |
| `band`             | `padding`, `paddingInner`, `paddingOuter`, `reverse`                     |
| `point`            | `padding`, `paddingOuter`, `reverse`                                     |
| `linear`           | `domain`, `range`, `nice`, `clamp`, `reverse`                            |
| `power`            | Linear options plus `exponent`                                           |
| `log`              | Linear options plus `base`; only strictly positive values are valid      |
| `symlog`           | Linear options plus the linear-region `constant`; supports signed values |
| `time`             | Local calendar ticks for `Date` values                                   |
| `utc`              | UTC calendar ticks for `Date` values                                     |
| `ordinal-color`    | Categorical domain and string color range                                |
| `continuous-color` | Numeric or temporal domain and interpolated string color range           |

Use named scales when marks need independent domains or units:

```tsx
<ServicePlot.Root data={rows} rowKey="id" label="Traffic and latency">
  <ServicePlot.Scale name="time" channel="x" type="utc" />
  <ServicePlot.Scale name="requests" channel="y" type="linear" nice />
  <ServicePlot.Scale name="latency" channel="y" type="symlog" constant={10} nice />

  <ServicePlot.Bar x="timestamp" y="requests" xScale="time" yScale="requests" />
  <ServicePlot.Line x="timestamp" y="p95" xScale="time" yScale="latency" />

  <ServicePlot.Axis scale="time" orient="bottom" label="Time (UTC)" />
  <ServicePlot.Axis scale="requests" orient="left" label="Requests" />
  <ServicePlot.Axis scale="latency" orient="right" label="P95 latency (ms)" />
</ServicePlot.Root>
```

Use actual `Date` instances for temporal inference. Normalize transport strings before passing rows to the plot. Select `utc` explicitly when calendar boundaries must not depend on the viewer's local time zone.

## Marks

Every mark accepts optional mark-local `data`, `transform`, named `xScale`, `yScale`, and `colorScale`, plus `fill`, `stroke`, `opacity`, `title`, `key`, and `hidden`.

| Mark    | Required channels             | Main use                                                       |
| ------- | ----------------------------- | -------------------------------------------------------------- |
| `Bar`   | `x`, numeric `y`              | Vertical/horizontal bars, histograms, stacks, bounded progress |
| `Line`  | `x`, numeric `y`              | Trends with linear, step, or monotone curves                   |
| `Area`  | `x`, numeric `y`              | Filled trends, ranges through `y2`, and stacked areas          |
| `Point` | `x`, numeric `y`              | Scatter, trend points, variable radius, timeline milestones    |
| `Arc`   | numeric `value`               | Pie, donut, and bounded gauge compositions                     |
| `Cell`  | `x`, `y`                      | Heatmaps with optional numeric `value` color channel           |
| `Rect`  | optional `x`, `x2`, `y`, `y2` | Ranges and `partition(...)` flame layouts                      |
| `Rule`  | optional `x`, `x2`, `y`, `y2` | Reference lines, intervals, timeline spans                     |
| `Text`  | `x`, `y`, `text`              | Labels and annotations                                         |

Common family compositions:

- Cartesian: `Bar`, `Line`, `Area`, and `Point`
- Pie: `Arc innerRadius={0}`
- Donut: `Arc` with a positive `innerRadius`
- Gauge: bounded `Arc` plus root meter semantics
- Heatmap: `Cell`
- Flame graph: `Rect transform={partition(...)}`
- Timeline: `Rule`, `Point`, and `Text`
- Progress: bounded `Bar` plus root meter semantics

See [examples/mark-families.tsx](./examples/mark-families.tsx) for all nine marks.

## Interaction descriptors

| Primitive   | Contract                                                                |
| ----------- | ----------------------------------------------------------------------- |
| `Legend`    | Named scale, label, position, and optional interactive filtering        |
| `Tooltip`   | Structured values with auto, nearest-mark, or shared nearest-x mode      |
| `Crosshair` | x, y, or xy inspection guide                                            |
| `Select`    | Single or toggle selection before optional activation                   |
| `Zoom`      | x, y, or xy zoom with wheel, pinch, and pan toggles plus min/max extent |
| `Brush`     | x, y, or xy brush; Shift is the default product-safe modifier choice    |

Primary drag pans when pan is enabled. Wheel and pinch zoom the enabled axes. Shift-drag brushing avoids stealing ordinary page gestures. Arrow keys inspect marks; Enter or Space activates the focused mark; plus and minus zoom; Home resets the view; and Shift plus an arrow pans. With `Select`, pointer and keyboard activation update selection first and pass the same immutable `PlotInteractionTarget` to `onActivate(row, key, target)`. Background click and Escape clear selection.

Interactive legends filter their color scale without rewriting caller data. Stable row keys retain selection when rows are updated.

## View, selection, and follow-latest

`PlotView` contains optional x and y domain tuples plus `scales`, a map of named coordinate-scale domains. `x` and `y` are deterministic primary-scale aliases; a named `scales` entry takes precedence for that scale. Use `defaultView` for uncontrolled state or `view` plus `onViewChange` when a route, URL, or shared owner controls navigation.

`PlotSelection` is `{ keys: readonly (string | number)[] }`. Use `defaultSelection` for local state or `selection` plus `onSelectionChange` for controlled state.

`followLatest` accepts:

- a number as row-count shorthand;
- `{ rows: number }`;
- `{ durationMs, field }`, where `field` is a `Date` field or accessor.

User pan or zoom pauses following. It stays paused until `PlotApi.resumeLive()` is called, so new data never unexpectedly pulls an operator away from an inspected range.

## Plot API and exports

`onApiChange` receives this mounted API:

```ts
interface PlotApi<Row> {
  resetView(): void;
  resumeLive(): void;
  exportPng(options?: PlotPngExportOptions): Promise<Blob>;
  exportSvg(options?: PlotSvgExportOptions): string;
  exportData(options?: PlotDataExportOptions): string;
  readonly rows: readonly Row[];
}
```

PNG and SVG export options select `view: "current" | "full"`, a resolved background (or `null` for transparency), and whether transient overlays are included. PNG also accepts `pixelRatio`. Hover, crosshair, and brush overlays are excluded by default.

Data export selects:

- `view: "current" | "full"`;
- `rows: "source" | "transformed"`;
- `scope: "all" | "visible" | "selected"`;
- `format: "csv" | "json"`.

PNG and SVG require a mounted plot with resolved dimensions. SVG references fonts rather than embedding them. Export does not create a visible SVG renderer.

CSV export neutralizes string cells that spreadsheet applications could interpret as formulas. JSON export preserves dates as ISO strings and represents non-finite numbers as `null`.

## Signed, missing, and log data

- Finite negative values remain negative through domains, stacks, symlog scales, summaries, and exports.
- Diverging stacks keep positive and negative accumulators on opposite sides of zero.
- Expand stacks normalize positive and negative totals independently.
- `null`, `undefined`, invalid dates, and `NaN` or infinite numbers are missing.
- A false `Line.defined` accessor result is a real path break, including when it guards a missing channel value.
- Aggregates and moving windows skip missing numeric values rather than adding zero.
- A log scale omits zero and negative inputs because they are outside its domain. Use `symlog` when signed or zero-adjacent values are meaningful.
- Development diagnostics and accessible summaries expose omitted counts.

## SSR and accessibility

Server rendering emits the reserved region, title, description, legend, summary, empty state when applicable, and keyboard/data instructions. It does not emit graphical marks.

After hydration, the root mounts separate chrome, clipped-mark, and transient-overlay canvases. “View data” materializes the full transformed DOM table on demand rather than duplicating every row in the initial document.

Without JavaScript, users retain the semantic label, summary, legend, and instructions but do not see graphical marks or the on-demand table. Do not make a tooltip or canvas pixel the only source of essential information.

Bounded progress and gauge compositions must set `meter` on the root so the semantic minimum, maximum, current value, and optional value text remain available independently of the canvas.

## Rendering and motion

The renderer accounts for device-pixel ratio, responsive resize, font readiness, reduced motion, and chart-token/theme changes. It uses viewport culling, line downsampling, point batching, visible-bar culling, and a spatial hit index for dense scenes. Above the visible-mark animation threshold, the renderer favors one reduced-cost scene transition over per-mark motion.

Motion is progressive enhancement. Reduced-motion preferences disable nonessential transitions while preserving state changes.

## Styling

The stylesheet is self-contained and also consumes compatible Askr theme tokens when present. Prefer overriding chart tokens over internal selectors:

- layout: `--ak-chart-height`, `--ak-chart-gap`, `--ak-chart-padding`, `--ak-chart-radius`
- type: `--ak-chart-font-family`, `--ak-chart-font-family-mono`, `--ak-chart-font-size`
- series: `--ak-chart-series-1` through `--ak-chart-series-10`
- surfaces: `--ak-chart-bg`, `--ak-chart-surface`, `--ak-chart-surface-muted`, `--ak-chart-border`
- interaction: `--ak-chart-focus-ring`, `--ak-chart-selection`, `--ak-chart-crosshair`
- motion: `--ak-chart-transition-duration`, `--ak-chart-transition-easing`

Structural `data-slot="plot-*"` hooks are stable application/testing seams. Do not depend on canvas-internal geometry or generated scene IDs for product CSS.

## Clean-break migration table

| Old component or entrypoint             | Primitive replacement                                      |
| --------------------------------------- | ---------------------------------------------------------- |
| `AreaChart`                             | `Plot.Area`                                                |
| `BarChart`                              | `Plot.Bar`                                                 |
| `LineChart`                             | `Plot.Line` plus optional `Plot.Point`                     |
| `DonutChart`, `PieChart`, `RadialGauge` | `Plot.Arc` with radius/bounds choices                      |
| `StackedBarChart`                       | `Plot.Bar stack="series"`                                  |
| `Sparkline`                             | Compact `Plot.Line` or `Plot.Area` composition             |
| `Heatmap`                               | `Plot.Cell`                                                |
| `Timeline`                              | `Plot.Rule`, `Plot.Point`, `Plot.Text`                     |
| `FlameGraph`                            | `Plot.Rect` plus `partition(...)`                          |
| `ProgressMeter`                         | Bounded `Plot.Bar` plus root meter semantics               |
| `ChartLegend`                           | `Plot.Legend`                                              |
| `ChartShell`, `ChartPanel`              | `Plot.Root` inside app-owned layout/card chrome            |
| `ChartEmptyState`                       | `Root empty`; route-owned loading/error UI remains outside |
| `/components`, `/core`                  | Root `@askrjs/charts` export                               |
| `/default`, root CSS, per-chart CSS     | `@askrjs/charts/styles`                                    |

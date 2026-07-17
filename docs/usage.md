# Usage

## Import the 0.1 surface

```tsx
import {
  appendPlotRows,
  bin,
  constant,
  count,
  createPlot,
  filterRows,
  group,
  mean,
  movingAverage,
  movingWindow,
  normalize,
  partition,
  regression,
  removePlotRows,
  sortRows,
  stack,
  sum,
  trimPlotRows,
  upsertPlotRows,
} from "@askrjs/charts";
```

Load styles once in application CSS:

```css
@import "@askrjs/charts/styles";
```

Do not create the plot factory during render:

```tsx
type RequestRow = {
  id: string;
  timestamp: Date;
  latencyMs: number | null;
  outcome: "ok" | "error";
};

const RequestPlot = createPlot<RequestRow>();
```

## Fields, accessors, and constants

Typed field names are the shortest channel form:

```tsx
<RequestPlot.Point x="timestamp" y="latencyMs" fill="outcome" />
```

Accessors are useful for units or derived labels. Return `null` or `undefined` to mark a value missing:

```tsx
<RequestPlot.Point
  x={(row) => row.timestamp}
  y={(row) => (row.latencyMs == null ? null : row.latencyMs / 1_000)}
  title={(row) => `${row.outcome}: ${row.latencyMs ?? "missing"} ms`}
/>
```

A bare string names a field. Use `constant(...)` for literal strings:

```tsx
<RequestPlot.Line x="timestamp" y="latencyMs" stroke={constant("#2563eb")} />
```

This distinction prevents a field name such as `red` from being confused with a CSS color.

## Channel expressions

Expressions are immutable and can be kept near the plot definition:

```tsx
const latencyBin = bin("latencyMs", { thresholds: 20 });
const rowCount = count();
const totalLatency = sum("latencyMs");
const meanLatency = mean("latencyMs");
const outcomeGroup = group("outcome");
const divergingLatency = stack("latencyMs", { offset: "diverging" });
const normalizedLatency = normalize("latencyMs");
const rollingMaximum = movingWindow("latencyMs", {
  window: 12,
  operation: "max",
  partial: false,
});
const rollingMean = movingAverage("latencyMs", { window: 7 });
const latencyTrend = regression("latencyMs", { x: "timestamp" });
```

Use them as typed channels:

```tsx
<RequestPlot.Root data={rows} rowKey="id" label="Request latency distribution">
  <RequestPlot.Bar x={latencyBin} y={rowCount} fill="outcome" stack="outcome" />
  <RequestPlot.Line x="timestamp" y={rollingMean} />
  <RequestPlot.Line x="timestamp" y={latencyTrend} />
</RequestPlot.Root>
```

Aggregation expressions operate within the active bin/group. `group(...)` declares a grouping channel; `count`, `sum`, and `mean` produce its numeric result. `stack(...)` accepts `offset: "zero" | "diverging" | "expand"` and a stable series order. `normalize(...)` produces proportional values.

`movingWindow` supports `sum`, `mean`, `min`, and `max`. Set `partial: false` to leave the leading incomplete window missing. `movingAverage` fixes the operation to `mean`. Regression is linear in 0.1 and uses row index unless `x` is supplied.

## Mark-local transforms

Filter and sort one mark without rewriting the root's source rows:

```tsx
<RequestPlot.Line
  transform={[
    filterRows<RequestRow>((row) => row.outcome === "ok"),
    sortRows<RequestRow>({ by: "timestamp", direction: "ascending" }),
  ]}
  x="timestamp"
  y="latencyMs"
/>
```

Partition accepts either flat `id`/`parentId` rows or nested `children` rows. `Rect` can consume its generated layout without explicit x/y channels:

```tsx
type FrameRow = {
  id: string;
  parentId: string | null;
  label: string;
  service: string;
  durationMs: number;
};

const TracePlot = createPlot<FrameRow>();

<TracePlot.Root data={frames} rowKey="id" label="Request trace">
  <TracePlot.Rect
    transform={partition<FrameRow>({
      id: "id",
      parentId: "parentId",
      value: "durationMs",
      padding: 0.004,
    })}
    fill="service"
    title="label"
  />
  <TracePlot.Legend interactive label="Service" />
  <TracePlot.Tooltip channels={["label", "durationMs"]} />
</TracePlot.Root>;
```

## Automatic and explicit scales

For a single Cartesian composition, inferred scales, axes, and tooltips are usually enough:

```tsx
<RequestPlot.Root data={rows} rowKey="id" label="P95 latency">
  <RequestPlot.Line x="timestamp" y="latencyMs" />
  <RequestPlot.Point x="timestamp" y="latencyMs" />
</RequestPlot.Root>
```

Use explicit named scales when domains, time zones, or units differ:

```tsx
type ServiceRow = {
  id: string;
  timestamp: Date;
  requests: number;
  p95: number;
};

const ServicePlot = createPlot<ServiceRow>();

<ServicePlot.Root data={serviceRows} rowKey="id" label="Requests and latency">
  <ServicePlot.Scale name="time" channel="x" type="utc" />
  <ServicePlot.Scale name="requests" channel="y" type="linear" nice />
  <ServicePlot.Scale
    name="latency"
    channel="y"
    type="symlog"
    constant={10}
    nice
  />

  <ServicePlot.Bar x="timestamp" y="requests" xScale="time" yScale="requests" />
  <ServicePlot.Line x="timestamp" y="p95" xScale="time" yScale="latency" />
  <ServicePlot.Point x="timestamp" y="p95" xScale="time" yScale="latency" />

  <ServicePlot.Axis scale="time" orient="bottom" label="UTC time" />
  <ServicePlot.Axis scale="requests" orient="left" label="Requests" />
  <ServicePlot.Axis scale="latency" orient="right" label="P95 (ms)" />
  <ServicePlot.Grid scale="latency" axis="y" />
</ServicePlot.Root>;
```

Use `power` with `exponent`, `log` with `base`, and `symlog` with its linear-region `constant`. A log scale accepts strictly positive values only. `time` uses local calendar ticks; `utc` uses UTC calendar ticks.

Color scales can be named too:

```tsx
<RequestPlot.Scale
  name="outcomes"
  channel="color"
  type="ordinal-color"
  domain={["ok", "error"]}
/>
<RequestPlot.Bar
  x={bin("latencyMs", { interval: 50 })}
  y={count()}
  fill="outcome"
  colorScale="outcomes"
/>
<RequestPlot.Legend scale="outcomes" interactive />
```

## Mark recipes

### Cartesian

```tsx
<Plot.Bar x="category" y="value" orientation="vertical" radius={4} />
<Plot.Line
  x="timestamp"
  y="value"
  defined={(row) => row.value != null}
  curve="monotone"
  strokeWidth={2}
/>
<Plot.Area x="timestamp" y="high" y2="low" curve="monotone" />
<Plot.Point x="timestamp" y="value" r="weight" shape="diamond" />
```

### Pie, donut, and gauge

```tsx
<SharePlot.Arc value="value" category="category" innerRadius={0} />
<SharePlot.Arc
  value="value"
  category="category"
  innerRadius={48}
  padAngle={0.02}
  cornerRadius={6}
/>

<GaugePlot.Root
  data={gaugeRows}
  rowKey="id"
  label="Storage used"
  meter={{ role: "meter", min: 0, max: 100, value: 72, valueText: "72%" }}
>
  <GaugePlot.Arc value="value" min={0} max={100} startAngle={-Math.PI} endAngle={0} />
</GaugePlot.Root>
```

`Line.defined` starts a new path run after every false row, so Canvas painting, hit regions,
downsampling, and SVG export all preserve the same discontinuities. `Arc.padAngle` separates
adjacent sectors and `Arc.cornerRadius` rounds their radial corners.

### Heatmap

```tsx
<HeatPlot.Cell x="day" y="hour" value="requests" inset={1} />
```

### Timeline

```tsx
<TimelinePlot.Rule x="startedAt" x2="finishedAt" y="lane" strokeWidth={3} />
<TimelinePlot.Point x="startedAt" y="lane" />
<TimelinePlot.Text x="startedAt" y="lane" text="label" align="left" />
```

### Progress

```tsx
<ProgressPlot.Root
  data={progressRows}
  rowKey="id"
  label="Migration progress"
  meter={{ role: "meter", min: 0, max: 100, value: 64, valueText: "64%" }}
>
  <ProgressPlot.Bar
    x="label"
    y="value"
    min={0}
    max={100}
    orientation="horizontal"
  />
</ProgressPlot.Root>
```

See [mark-families.tsx](../examples/mark-families.tsx) for one typed source file containing every mark.

## Tooltips, crosshair, legend, zoom, and brush

```tsx
<RequestPlot.Tooltip
  channels={["timestamp", "latencyMs", "outcome"]}
  format={(record) => `${record.outcome}: ${record.latencyMs} ms`}
/>
<RequestPlot.Crosshair axes="xy" />
<RequestPlot.Legend scale="outcomes" interactive position="bottom" />
<RequestPlot.Zoom axes="xy" wheel pinch pan min={1} max={64} />
<RequestPlot.Brush axis="x" modifier="shift" />
```

Wheel and pinch zoom the enabled axes. Primary drag pans when enabled. Shift-drag brushing avoids taking ordinary drag gestures from the page. Keyboard inspection reads the same hit records as pointer inspection.

Use `onActivate` for product drill-down:

```tsx
<RequestPlot.Root
  data={rows}
  rowKey="id"
  label="Request latency"
  onActivate={(row, key) => openRequest(row.id, key)}
>
  <RequestPlot.Point x="timestamp" y="latencyMs" />
</RequestPlot.Root>
```

## Controlled view and selection

Use `defaultView` and `defaultSelection` for local plot state. Use controlled props when a route, URL, or shared owner must persist the state:

```tsx
const [view, setView] = state<PlotView>({});
const [selection, setSelection] = state<PlotSelection>({ keys: [] });

<RequestPlot.Root
  data={rows}
  rowKey="id"
  label="Request latency"
  view={view()}
  onViewChange={(next) => setView(next)}
  selection={selection()}
  onSelectionChange={(next) => setSelection(next)}
>
  <RequestPlot.Line x="timestamp" y="latencyMs" />
  <RequestPlot.Zoom axes="xy" />
  <RequestPlot.Brush axis="x" modifier="shift" />
</RequestPlot.Root>;
```

Import `state` from `@askrjs/askr` and `PlotView`/`PlotSelection` as types from `@askrjs/charts` in a real component.

## Live rows and follow-latest

Update a readonly array through Askr state:

```tsx
setRows((current) =>
  trimPlotRows(appendPlotRows(current, nextRow), {
    durationMs: 5 * 60_000,
    field: "timestamp",
  }),
);
```

Other immutable update forms:

```tsx
setRows((current) => upsertPlotRows(current, changedRows, "id"));
setRows((current) => removePlotRows(current, removedIds, "id"));
setRows((current) => trimPlotRows(current, { rows: 1_000 }));
```

Pass the Askr state getter directly as plot data and configure a matching follow window:

```tsx
<RequestPlot.Root
  data={rows}
  rowKey="id"
  label="Live requests"
  followLatest={{ durationMs: 5 * 60_000, field: "timestamp" }}
  apiRef={(next) => {
    api = next;
  }}
>
  <RequestPlot.Line x="timestamp" y="latencyMs" />
  <RequestPlot.Zoom axes="x" />
</RequestPlot.Root>
```

Pan or zoom pauses following. Resume only in response to explicit operator intent:

```tsx
<button type="button" onClick={() => api?.resumeLive()}>
  Resume live
</button>
```

## Export

Capture the mounted API with `apiRef`:

```tsx
let api: PlotApi<RequestRow> | null = null;

<RequestPlot.Root
  data={rows}
  rowKey="id"
  label="Request latency"
  apiRef={(next) => {
    api = next;
  }}
>
  <RequestPlot.Line x="timestamp" y="latencyMs" />
</RequestPlot.Root>;
```

Then export the same scene:

```ts
const png = await api?.exportPng({ view: "current", pixelRatio: 2 });
const svg = api?.exportSvg({ view: "full", background: "#ffffff" });
const csv = api?.exportData({
  view: "current",
  rows: "transformed",
  scope: "selected",
  format: "csv",
});
```

PNG and SVG require mounted dimensions. Current/full view and optional background are supported. Transient overlays are excluded unless `includeOverlays` is true. Data export can choose current/full view, source/transformed rows, and all/visible/selected scope.

## Empty, missing, signed, and log values

```tsx
<RequestPlot.Root
  data={rows}
  rowKey="id"
  label="Request latency"
  empty="No request latency is available for this range."
  diagnostics
  summary={({ sourceRowCount, visibleRowCount, omittedRowCount }) =>
    `${visibleRowCount} of ${sourceRowCount} rows visible; ${omittedRowCount} omitted.`
  }
>
  <RequestPlot.Scale name="latency" channel="y" type="log" />
  <RequestPlot.Point x="timestamp" y="latencyMs" yScale="latency" />
</RequestPlot.Root>
```

Negative finite values are preserved. Missing and non-finite values are not converted to zero. Log scales omit zero and negative inputs and report the omission; choose `symlog` when those values are meaningful.

## SSR and accessibility

Always supply a useful `label`, and use `title`, `description`, or `summary` to explain the product question. SSR includes the reserved region and semantic content but not graphical marks. After hydration, canvas marks appear and the full transformed table is created only when “View data” is opened.

Tooltips must not carry the only copy of an important value. Use root meter semantics for bounded progress and gauges. Keep route-owned loading and errors outside the plot; use `empty` only for a successfully loaded empty dataset.

## Styling and sizing

Use `width` and `height` for deterministic embedded or export dimensions. Otherwise let the root observe its container. Override chart tokens at an app boundary:

```css
.operations-plot {
  --ak-chart-height: 24rem;
  --ak-chart-series-1: var(--ak-color-accent);
  --ak-chart-grid: color-mix(in srgb, currentcolor 14%, transparent);
}
```

Prefer `--ak-chart-*` tokens and stable `data-slot="plot-*"` hooks. Do not style generated scene IDs or assume canvas geometry is DOM.

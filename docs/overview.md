# Askr Charts overview

`@askrjs/charts` 0.1 is a typed plotting engine for Askr applications. It replaces the old CSS-first component catalog with one composition model:

```text
typed rows + JSX descriptors
  → transforms and scales
  → immutable scene
  → Canvas 2D paint and hit index
  → PNG, SVG, and data export
```

The scene is the authority. Canvas is the mounted mark renderer; SVG is generated only when exported.

## One factory, one row contract

```tsx
import { createPlot } from "@askrjs/charts";

type Row = { id: string; timestamp: Date; value: number };

const Plot = createPlot<Row>();
```

Keep the factory at module scope. It binds typed field names and accessors to every primitive and brands its children so another factory's descriptors cannot be mixed into the root.

`Plot.Root` accepts arrays, fragments, conditional children, and zero-argument child getters. The compiler remains DOM-free: it resolves those descriptors into scales, axes, grids, marks, hit regions, legends, diagnostics, accessible records, and export rows before either renderer consumes them.

## Root responsibilities

The root owns plotting concerns:

- readonly source data or a reactive data getter;
- stable row keys;
- responsive dimensions and device-pixel ratio;
- title, description, empty state, summary, and meter semantics;
- inferred or explicit scales, axes, grids, legends, and tooltips;
- view, selection, activation, zoom, pan, brush, and follow-latest state;
- the mounted `PlotApi<Row>`.

The application still owns product concerns such as route loading, errors, cards, filters, and navigation.

## Defaults first, explicit composition when needed

The compiler infers common scales from channel values and mark context:

- numeric → linear;
- `Date` → local time;
- categorical bar/cell position → band;
- categorical line/area/point position → point;
- categorical color → ordinal color;
- numeric or temporal color → continuous color.

Cartesian marks receive default axes and tooltip behavior. Explicit `Scale`, `Axis`, `Grid`, `Legend`, and `Tooltip` children replace the matching defaults. Named scales let independent marks use separate domains, including left/right dual axes and local-time/UTC choices.

The other built-in numeric scales are power, log, and symlog. Use log only for strictly positive values; use symlog when signed values or zero matter.

## Composition replaces named charts

The nine marks cover the old families without chart-specific wrappers:

- `Bar`, `Line`, `Area`, and `Point` for Cartesian plots;
- `Arc` for pie, donut, and gauge compositions;
- `Cell` for heatmaps;
- `Rect` with `partition(...)` for flame graphs;
- `Rule`, `Point`, and `Text` for timelines;
- bounded `Bar` for progress.

Root meter semantics keep progress and gauges accessible even though the visible marks are canvas pixels.

## Typed channels and transforms

Channels accept typed field names, accessors, or immutable expressions. Bare strings mean fields; `constant(...)` marks literal strings. Expressions cover bins, counts, sums, means, grouping, stacks, normalization, moving windows, moving averages, and regression.

Mark-level `filterRows`, `sortRows`, and `partition` descriptors transform a local row stream without changing the source array. Live data helpers append, upsert, remove, and trim rows immutably. Stable keys retain selection and identity across updates.

## Correctness rules

The engine does not silently manufacture data:

- negative values remain negative;
- `null`, `undefined`, invalid dates, and non-finite numbers are missing, not zero;
- aggregates and windows skip missing numeric inputs;
- log scales omit zero and negative values;
- diagnostics and accessible summaries report omitted counts.

Categorical strings are never guessed to be literal colors. Use `constant(...)` for constants and a field name for data-driven color.

## Mounted rendering

After hydration, the root mounts two canvases:

- a base canvas for stable scene marks;
- a chrome canvas for adaptive axes and grids;
- a clipped marks canvas that alone receives transient gesture transforms;
- an overlay canvas for hover, focus, crosshair, brush, and other transient interaction.

The renderer responds to container size, device-pixel ratio, font readiness, reduced motion, and chart-token/theme changes. Dense scenes use culling, line envelopes, point batching, and a spatial hit index. Transient overlays are omitted from exports unless explicitly requested.

## SSR and data access

SSR reserves the plot region and emits the semantic title, description, legend, summary, empty state, and keyboard/data instructions. It does not serialize graphical SVG marks.

The transformed DOM table is materialized only when the user opens “View data.” Without JavaScript, semantic context remains available but graphical marks and the on-demand table do not.

Tooltips enhance inspection; they are never the only way to understand essential data.

## Styling

Import `@askrjs/charts/styles` once. The stylesheet owns structural layout, overlays, focus, controls, and the data table. Self-contained `--ak-chart-*` tokens work alone and adopt compatible `@askrjs/themes` values when present.

## Deliberate 0.1 limits

- Canvas 2D is the only mounted renderer.
- SVG exists for export only.
- There is no WebGL, worker, OffscreenCanvas, or public custom-renderer API.
- Exports require mounted, resolved dimensions.
- SVG fonts are referenced, not embedded.
- No-JavaScript output is semantic rather than graphical.

Continue with [usage recipes](./usage.md), the full [charting contract](../CHARTING.md), or the runnable source under [`examples/`](../examples/).

# Charting

`@askrjs/charts` is the CSS-first chart companion to `@askrjs/themes`.
It provides product UI dashboard charts: recognizable visual summaries that
are composable, responsive, themeable, and useful without introducing a full
analytics plotting engine.

Import the default chart surface styles:

```css
@import "@askrjs/charts/default";
```

## Positioning

`askr-charts` should feel like clean, fast, composable product charts that
developers can drop into dashboards without thinking.

The library optimizes for:

- Product UI dashboards, similar in feel to GitHub, Vercel, Stripe, and Linear
- Recognition within one second
- Semantic HTML with CSS variables and layout-driven rendering
- Good defaults over broad configuration
- Tooltips as enhancement, not the source of basic meaning

The library does not aim to be:

- A full analytics platform
- A D3 replacement
- A scientific plotting engine
- An infinitely configurable chart system

## Contract Surface

Shape-contract charts define data contracts, visual grammar, behavior
guarantees, and acceptance criteria:

| Chart | Visual target | Live example |
| --- | --- | --- |
| `AreaChart` | Filled trend over time | `../my-app/src/components/area-chart-example.tsx` |
| `BarChart` | Discrete category comparison via bars | `../my-app/src/components/bar-chart-example.tsx` |
| `LineChart` | Trend lines across an ordered axis | `../my-app/src/components/line-chart-example.tsx` |
| `DonutChart` | Circular part-to-whole with a center void | `../my-app/src/components/donut-chart-example.tsx` |
| `StackedBarChart` | Bars split into stacked segments | `../my-app/src/components/stacked-bar-chart-example.tsx` |
| `Sparkline` | Tiny minimal trend with no axes or legend | `../my-app/src/components/sparkline-example.tsx` |
| `Heatmap` | Grid of colored intensity cells | `../my-app/src/components/heatmap-example.tsx` |
| `Timeline` | Ordered sequence of events or intervals | `../my-app/src/components/timeline-example.tsx` |
| `FlameGraph` | Hierarchical stacked rectangles for cost visualization | `../my-app/src/components/flame-graph-example.tsx` |
| `ProgressMeter` | Linear progress fill versus max | `../my-app/src/components/progress-meter-example.tsx` |
| `RadialGauge` | Circular scalar gauge | `../my-app/src/components/radial-gauge-example.tsx` |

Supporting primitives are not shape-contract charts:

- `ChartShell`: layout, sizing, responsiveness, and theming hooks
- `ChartPanel`: dashboard card wrapper for title, description, and layout
- `ChartLegend`: shared legend rendering
- `ChartEmptyState`: loading, empty, and error presentation

## Shared Behavior

All charts render from state supplied by the caller. They do not fetch data.

Supported states are:

- `loading`: reserved layout or skeleton through surrounding composition
- `loaded`: chart renders from the provided data
- `empty`: render `ChartEmptyState`
- `error`: render `ChartEmptyState` with an error variant
- `stale`: keep old data visible and pair it with a subtle loading indicator

Tooltips:

- Trigger on hover, focus, and touch-capable pointer movement
- Include label, value, series when available, and formatted value
- Anchor to the nearest data element
- Must be keyboard reachable where the data element is interactive
- Must never be required for basic understanding

Animation:

- Progressive enhancement only
- Initial render uses a subtle reveal
- Updates should transition from the previous value where CSS can express it
- Add/remove and empty/data transitions should fade or resize without layout jumps
- Reduced motion disables chart animation by default
- Motion must explain change, not decorate

## Public Hooks

Stable hooks and contract points:

- `data-slot="chart-shell"`
- `data-slot="chart-panel"`
- `data-slot="chart-legend"`
- `data-slot="chart-empty-state"`
- `data-slot="chart-graphic"`
- `data-slot="chart-summary"`
- `data-slot="chart-table"`

Core CSS variables:

- `--ak-chart-color-primary`
- `--ak-chart-color-muted`
- `--ak-chart-gap`
- `--ak-chart-radius`
- `--ak-chart-font-size`

Responsive rules:

- Build chart shells mobile first.
- Use `data-slot` hooks instead of internal DOM selectors
- Keep selectors low-specificity so consumers can override them with one rule
- The default chart package standardizes responsive layout at `48rem` and `64rem`

## Shape Contracts

### AreaChart

Purpose: show a filled trend over ordered points when the exact values matter
less than the overall movement.

Visual grammar: a continuous filled series with connected points, a quiet
baseline, and enough horizontal rhythm to read as time or sequence. It must not
read as a histogram or a row of independent blocks.

Data shape: accepts value chart object or tuple inputs with `label`, `value`,
optional `description`, and optional `accentColor`. Supports `min`, `max`,
`summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
points, and use `grow` animation by default. Empty and error states should be
composed with `ChartEmptyState`.

Non-goals: no multi-series area plotting, no precise axis engine, no stacked
area mode.

### BarChart

Purpose: compare discrete categories through horizontal bars.

Visual grammar: one bar per category, stable tracks, visible labels, and clear
relative length. Zero values must stay zero width.

Data shape: accepts value chart object or tuple inputs with `label`, `value`,
optional `description`, and optional `accentColor`. Supports `min`, `max`,
`labelDensity`, `summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose focusable
tooltip-ready rows, and use `grow` animation by default.

Non-goals: no grouped bars, no axis-heavy analytical layout, no vertical bar
mode in the default contract.

### LineChart

Purpose: show trend movement across ordered points with the line as the primary
mark.

Visual grammar: connected points and sloped segments across a quiet plotting
area. The chart must read as a line first, without area fill or bar-like stems.

Data shape: accepts value chart object or tuple inputs with `label`, `value`,
optional `description`, and optional `accentColor`. Supports `min`, `max`,
`summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
points, and use `fade` animation by default.

Non-goals: no precise interpolation engine, no multi-axis plotting, no dense
scientific time-series rendering.

### DonutChart

Purpose: show part-to-whole composition in a compact circular form.

Visual grammar: segmented circular ring, consistent ring thickness, center
void, and readable total or center value. Segment labels are secondary.

Data shape: accepts object or tuple segment inputs with `label`, `value`,
optional color, and optional `description`. Supports `labelDensity`, `summary`,
`valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
segments and legend items, and use `sweep` animation by default.

Non-goals: no nested donuts, no polar analytical charting, no tiny segments
that depend on tooltip-only understanding.

### StackedBarChart

Purpose: compare totals while preserving each bar's internal composition.

Visual grammar: one horizontal track per category, split into proportional
segments with stable boundaries and concise labels.

Data shape: accepts rows with `label` and `segments`; each segment has `label`,
`value`, optional `description`, and optional `accentColor`. Supports `summary`,
`valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
segments, and use `grow` animation by default. Zero-value segments stay zero
width.

Non-goals: no grouped stacked combinations, no waterfall behavior, no
spreadsheet-style table replacement.

### Sparkline

Purpose: show a tiny trend inside dense product UI.

Visual grammar: minimal inline trend with small points or columns, no axes, no
legend, and no surrounding chart chrome.

Data shape: accepts value chart object or tuple inputs with `label`, `value`,
optional `description`, and optional `accentColor`. Supports `min`, `max`,
`summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
points, and use `fade` animation by default.

Non-goals: no labels-first charting, no large plotting stage, no analytical
axis treatment.

### Heatmap

Purpose: show intensity across two categorical dimensions.

Visual grammar: dense grid of equally sized cells where color intensity carries
the value. Missing combinations render as zero-value cells.

Data shape: accepts object inputs with `x`, `y`, `value`, optional
`description`, and optional `accentColor`, or tuple inputs. Supports `min`,
`max`, `summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
cells, and use `fade` animation by default.

Non-goals: no calendar-specific layout contract, no continuous image heatmap,
no axis measurement engine.

### Timeline

Purpose: show an ordered sequence of events or intervals.

Visual grammar: compact vertical or inline sequence with markers, short labels,
and bounded item rhythm. It must not look like an oversized bulleted list.

Data shape: accepts items with `label`, optional `value`, optional
`description`, and optional `accentColor`. Supports `labelDensity`, `summary`,
`valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
milestones, and use `slide` animation by default.

Non-goals: no full project management timeline, no gantt chart, no unbounded
long-form event feed.

### FlameGraph

Purpose: show hierarchical cost or time distribution.

Visual grammar: stacked rows of proportional rectangles where depth maps to
hierarchy and width maps to cost. Layout should resize stably without chaotic
motion.

Data shape: accepts nested frames with `label`, `value`, optional
`description`, optional `accentColor`, and optional `children`. Supports
`summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
frames, and use `grow` animation by default.

Non-goals: no profiler-grade navigation, no zoom stack, no canvas-style
large-trace renderer.

### ProgressMeter

Purpose: show scalar progress against a max value.

Visual grammar: bounded linear track, proportional fill, clear value text, and
compact description when supplied.

Data shape: accepts `label`, `value`, optional `max`, optional `description`,
optional `summary`, optional `valueFormatter`, `animate`, and `animation`.

States and behavior: render semantic `role="meter"` metadata and a summary,
and use `grow` animation by default. Zero values stay zero width.

Non-goals: no stacked progress, no trend history, no circular gauge behavior.

### RadialGauge

Purpose: show one scalar value as circular progress.

Visual grammar: compact circular dial, consistent ring thickness, bounded arc,
and center value. It should read as a scalar gauge, not a donut breakdown.

Data shape: accepts `label`, `value`, optional `max`, optional `description`,
optional `summary`, optional `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose a conic dial,
and use `sweep` animation by default.

Non-goals: no multi-segment gauge, no speedometer needle, no precise polar
axis.

## Testing Expectations

Every shape-contract chart must pass:

- Recognizable instantly
- Works without tooltip
- Looks correct inside a dashboard card
- Handles small, medium, and moderate datasets where the chart type supports it
- Exposes a semantic graphic or meter role with accessible labeling
- Provides a summary and fallback table or equivalent text structure
- Emits chart-specific animation hooks when animation is enabled
- Keeps tooltip targets focusable where item-level tooltip content exists

Generated chart presets live under `src/charts/<name>/`.
Use `npm run new:chart -- <chart-name>` to clone the template.

# Charting

`@askrjs/charts` is the CSS-first chart package for Askr product UI. It
provides dashboard charts: recognizable visual summaries that are composable,
responsive, themeable, and useful without introducing a full analytics plotting
engine or depending on `@askrjs/themes`.

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

| Chart             | Visual target                                          | Live example                                                             |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `AreaChart`       | Filled trend over time                                 | `../my-app/src/components/examples/charts/area-chart-example.tsx`        |
| `BarChart`        | Discrete category comparison via bars                  | `../my-app/src/components/examples/charts/bar-chart-example.tsx`         |
| `LineChart`       | Trend lines across an ordered axis                     | `../my-app/src/components/examples/charts/line-chart-example.tsx`        |
| `DonutChart`      | Circular part-to-whole with a center void              | `../my-app/src/components/examples/charts/donut-chart-example.tsx`       |
| `PieChart`        | Solid circular part-to-whole composition               | `../my-app/src/components/examples/charts/pie-chart-example.tsx`         |
| `StackedBarChart` | Bars split into stacked segments                       | `../my-app/src/components/examples/charts/stacked-bar-chart-example.tsx` |
| `Sparkline`       | Tiny minimal trend with no axes or legend              | `../my-app/src/components/examples/charts/sparkline-example.tsx`         |
| `Heatmap`         | Grid of colored intensity cells                        | `../my-app/src/components/examples/charts/heatmap-example.tsx`           |
| `Timeline`        | Ordered sequence of events or intervals                | `../my-app/src/components/examples/charts/timeline-example.tsx`          |
| `FlameGraph`      | Hierarchical stacked rectangles for cost visualization | `../my-app/src/components/examples/charts/flame-graph-example.tsx`       |
| `ProgressMeter`   | Linear progress fill versus max                        | `../my-app/src/components/examples/charts/progress-meter-example.tsx`    |
| `RadialGauge`     | Circular scalar gauge                                  | `../my-app/src/components/examples/charts/radial-gauge-example.tsx`      |

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

Chart CSS must remain self-sufficient. Broader Askr theme tokens may feed chart
tokens through chart-specific overrides such as `--ak-color-chart-primary`, but
display styles should use chart-owned `--ak-chart-*` variables as their
contract.

Responsive rules:

- Build chart shells mobile first.
- Use `data-slot` hooks instead of internal DOM selectors
- Keep selectors low-specificity so consumers can override them with one rule
- The default chart package standardizes responsive layout at `48rem` and `64rem`

## Shape Contracts

### AreaChart

Purpose: show a filled trend over ordered points when the exact values matter
less than the overall movement.

Real-world comparison: Vercel usage cards and Stripe balance trend panels.

Visual grammar: a continuous filled series with connected points, a quiet
baseline, and enough horizontal rhythm to read as time or sequence. It must not
read as a histogram or a row of independent blocks.

Data shape: accepts value chart object or tuple inputs with `label`, `value`,
optional `description`, and optional `color`. Supports `min`, `max`,
`summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
points, and use `grow` animation by default. Empty and error states should be
composed with `ChartEmptyState`.

Non-goals: no multi-series area plotting, no precise axis engine, no stacked
area mode.

### BarChart

Purpose: compare discrete categories through horizontal bars.

Real-world comparison: Stripe breakdown rows and GitHub repository language
bars.

Visual grammar: one bar per category, stable tracks, visible labels, and clear
relative length. The default `bar` variant is horizontal; `histogram` renders
vertical bins for compact distribution views. Zero values must stay zero width
or zero height.

Data shape: accepts value chart object or tuple inputs with `label`, `value`,
optional `description`, and optional `color`. Supports `min`, `max`,
`variant`, `labelDensity`, `summary`, `valueFormatter`, `animate`, and
`animation`.

States and behavior: render a summary and fallback table, expose focusable
tooltip-ready rows, and use `grow` animation by default.

Non-goals: no grouped bars, no axis-heavy analytical layout, no multi-series
histograms.

### LineChart

Purpose: show trend movement across ordered points with the line as the primary
mark.

Real-world comparison: Vercel analytics trend cards and GitHub traffic graphs.

Visual grammar: connected points and sloped segments across a quiet plotting
area. The chart must read as a line first, without area fill or bar-like stems.

Data shape: accepts value chart object or tuple inputs with `label`, `value`,
optional `description`, and optional `color`. Supports `min`, `max`,
`summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
points, and use `reveal` animation by default.

Non-goals: no precise interpolation engine, no multi-axis plotting, no dense
scientific time-series rendering.

### DonutChart

Purpose: show part-to-whole composition in a compact circular form.

Real-world comparison: Stripe payment-method mix cards and GitHub language
composition widgets.

Visual grammar: segmented circular ring, consistent ring thickness, surface
colored separators that do not read as data, a clear center total badge, and
legend rows with compact share rails. Segment labels are secondary but must be
readable without opening tooltips.

Data shape: accepts object or tuple segment inputs with `label`, `value`,
optional color, and optional `description`. Supports `labelDensity`, `summary`,
`valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
segments and legend items, and use `sweep` animation by default.

Non-goals: no nested donuts, no polar analytical charting, no tiny segments
that depend on tooltip-only understanding.

### PieChart

Purpose: show part-to-whole composition as a solid circular disc when the center
value treatment of a donut would add visual noise.

Real-world comparison: dashboard issue share, work-state, and incident share
widgets.

Visual grammar: segmented circular disc, consistent slice boundaries, and a
legend-style list for labels and values. It must read as a solid share chart,
not as a radial gauge or a donut with a missing center label.

Data shape: accepts object or tuple segment inputs with `label`, `value`,
optional color, and optional `description`. Supports `labelDensity`,
`summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
segments and legend items, and use `sweep` animation by default.

Non-goals: no exploded slices, no nested pies, no polar analytical charting, no
tiny segments that depend on tooltip-only understanding.

### StackedBarChart

Purpose: compare totals while preserving each bar's internal composition.

Real-world comparison: Linear issue status breakdowns and GitHub project status
bars.

Visual grammar: one horizontal track per category, split into proportional
segments with stable boundaries and concise labels.

Data shape: accepts rows with `label` and `segments`; each segment has `label`,
`value`, optional `description`, and optional `color`. Supports `summary`,
`valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
segments, and use `grow` animation by default. Zero-value segments stay zero
width.

Non-goals: no grouped stacked combinations, no waterfall behavior, no
spreadsheet-style table replacement.

### Sparkline

Purpose: show a tiny trend inside dense product UI.

Real-world comparison: GitHub repository insight sparklines and Stripe metric
delta cards.

Visual grammar: minimal inline trend with small points or columns, no axes, no
legend, and no surrounding chart chrome.

Data shape: accepts value chart object or tuple inputs with `label`, `value`,
optional `description`, and optional `color`. Supports `min`, `max`,
`summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
points, and use `fade` animation by default.

Non-goals: no labels-first charting, no large plotting stage, no analytical
axis treatment.

### Heatmap

Purpose: show intensity across two categorical dimensions.

Real-world comparison: GitHub contribution grids and operational activity
heatmaps.

Visual grammar: dense grid of equally sized cells where color intensity carries
the value. Missing combinations render as zero-value cells.

Data shape: accepts object inputs with `x`, `y`, `value`, optional
`description`, and optional `color`, or tuple inputs. Supports `min`,
`max`, `summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
cells, and use `fade` animation by default.

Non-goals: no calendar-specific layout contract, no continuous image heatmap,
no axis measurement engine.

### Timeline

Purpose: show an ordered sequence of events or intervals.

Real-world comparison: Linear activity timelines and deployment event timelines.

Visual grammar: compact vertical or inline sequence with markers, short labels,
and bounded item rhythm. It must not look like an oversized bulleted list.

Data shape: accepts items with `label`, optional `value`, optional
`description`, and optional `accentColor`. Supports `labelDensity`, `summary`,
`animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
milestones, and use `slide` animation by default.

Non-goals: no full project management timeline, no gantt chart, no unbounded
long-form event feed.

### FlameGraph

Purpose: show hierarchical cost or time distribution.

Real-world comparison: Chrome DevTools profiler flame charts and Sentry
performance traces.

Visual grammar: stacked rows of proportional rectangles where depth maps to
hierarchy and width maps to cost. Layout should resize stably without chaotic
motion.

Data shape: accepts nested frames with `label`, `value`, optional
`description`, optional `color`, and optional `children`. Supports
`summary`, `valueFormatter`, `animate`, and `animation`.

States and behavior: render a summary and fallback table, expose tooltip-ready
frames, and use `grow` animation by default.

Non-goals: no profiler-grade navigation, no zoom stack, no canvas-style
large-trace renderer.

### ProgressMeter

Purpose: show scalar progress against a max value.

Real-world comparison: quota usage bars, rollout completion meters, and
deployment progress indicators.

Visual grammar: bounded linear track, proportional fill, clear value text, and
compact description when supplied.

Data shape: accepts `label`, `value`, optional `max`, optional `description`,
optional `summary`, optional `valueFormatter`, `animate`, and `animation`.

States and behavior: render semantic `role="meter"` metadata and a summary,
and use `grow` animation by default. Zero values stay zero width.

Non-goals: no stacked progress, no trend history, no circular gauge behavior.

### RadialGauge

Purpose: show one scalar value as circular progress.

Real-world comparison: uptime/SLO gauge cards and quota utilization rings.

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

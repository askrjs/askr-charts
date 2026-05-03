# Charting

`@askrjs/charts` is the CSS-first chart companion to `@askrjs/themes`. The
theme package owns app chrome and shared UI, while this package stays focused
on lightweight visual summaries and chart-specific layout shells.

Import the default chart surface styles:

```css
@import "@askrjs/charts/default";
```

Public hooks and contract points:

- `data-slot="chart-shell"`
- `data-slot="chart-panel"`
- `data-slot="chart-legend"`
- `data-slot="chart-empty-state"`

Core CSS variables:

- `--ak-chart-color-primary`
- `--ak-chart-color-muted`
- `--ak-chart-gap`
- `--ak-chart-radius`
- `--ak-chart-font-size`

Responsive rules:

- Build chart shells mobile first.
- Use `data-slot` hooks instead of internal DOM selectors.
- Keep selectors low-specificity so package consumers can override them with one rule.
- The default chart package currently standardizes responsive layout at `48rem` and `64rem`.

Chart tokens use the `--ak-chart-*` prefix and stay scoped to the package's
presentation layer.

Included v1 components:

- `AreaChart`
- `BarChart`
- `DonutChart`
- `FlameGraph`
- `Heatmap`
- `LineChart`
- `ProgressMeter`
- `RadialGauge`
- `Sparkline`
- `StackedBarChart`
- `Timeline`

`LineChart` and `AreaChart` are intentionally discrete CSS approximations for
simple trend views. `RadialGauge` is a compact single-value dial. They are a
good fit when you want a clean visual summary without introducing an SVG or JS
charting engine.

Each chart renders semantic HTML, assigns dynamic values through CSS custom
properties, and includes a text summary plus a screen-reader table fallback.

Current data and labeling contract:

- Value charts accept object or tuple inputs where applicable.
- `BarChart`, `Sparkline`, and `Heatmap` accept explicit `min` and `max` scale bounds.
- `LineChart` and `AreaChart` accept the same value chart inputs and scale bounds.
- Visible-label charts accept `labelDensity="full" | "compact" | "minimal"`.
- Data items may expose CSS-only tooltips through `data-slot="chart-tooltip"`.
- `createValueChartLegendItems()` and `createHeatmapLegendItems()` generate legend data from source chart data.

Animation contract:

- Animation remains decorative and must not be required for chart correctness.
- Chart roots emit `data-ak-animate` and `data-ak-animation`.
- Animation timing is configured only through `--ak-chart-animation-*` variables.
- Animated items expose `--ak-chart-item-index` for CSS stagger.
- Reduced motion disables chart animation by default.

Testing expectations:

- Every visual chart should expose a `role="img"` graphic container with an `aria-label`.
- Every chart should provide a text summary via `data-slot="chart-summary"`.
- Every chart should provide a screen-reader fallback table or equivalent text structure.

Generated chart presets live under `src/charts/<name>/`.
Use `npm run new:chart -- <chart-name>` to clone the template.

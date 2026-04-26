# Charting

Import the default chart surface styles:

```css
@import "@askrjs/askr-charts/default";
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

- `BarChart`
- `DonutChart`
- `Heatmap`
- `ProgressMeter`
- `Sparkline`
- `StackedBarChart`
- `Timeline`

Each chart renders semantic HTML, assigns dynamic values through CSS custom
properties, and includes a text summary plus a screen-reader table fallback.

Testing expectations:

- Every visual chart should expose a `role="img"` graphic container with an `aria-label`.
- Every chart should provide a text summary via `data-slot="chart-summary"`.
- Every chart should provide a screen-reader fallback table or equivalent text structure.

Generated chart presets live under `src/charts/<name>/`.
Use `npm run new:chart -- <chart-name>` to clone the template.

# @askrjs/charts

CSS-first chart primitives for Askr dashboards and product UI.

`@askrjs/charts` pairs with `@askrjs/themes` and keeps chart rendering
composable, responsive, and themeable. Use it when you want charts that read
quickly in product interfaces without turning into a general-purpose plotting
library.

## Install

```bash
npm install @askrjs/charts @askrjs/themes
```

## Quick Start

Import the default chart and theme styles in your app stylesheet:

```css
@import "@askrjs/charts/default";
@import "@askrjs/themes/default";
```

Then render from the component surface:

```tsx
import { AreaChart, ChartPanel, ChartShell } from "@askrjs/charts/components";

const revenue = [
  { label: "Mon", value: 42 },
  { label: "Tue", value: 58 },
  { label: "Wed", value: 51 },
];

export function RevenueChart() {
  return (
    <ChartShell title="Revenue" description="Last 3 days">
      <ChartPanel title="Trend" description="Simple filled trend">
        <AreaChart label="Revenue trend" data={revenue} />
      </ChartPanel>
    </ChartShell>
  );
}
```

## Use The Right Surface

- `@askrjs/charts/components` exports the chart components and chart chrome:
  `AreaChart`, `BarChart`, `LineChart`, `DonutChart`, `StackedBarChart`,
  `Sparkline`, `Heatmap`, `Timeline`, `FlameGraph`, `ProgressMeter`,
  `RadialGauge`, `ChartShell`, `ChartPanel`, `ChartLegend`, and
  `ChartEmptyState`.
- `@askrjs/charts/core` exports normalization, formatting, animation, and
  legend helpers for advanced composition.
- The package is CSS-first, so the chart visuals still come from the imported
  stylesheets.

## Design Rules

- Charts should read quickly in product dashboards.
- Tooltips are an enhancement, not the only way to understand the data.
- Prefer compact, semantic layouts over analytical charting complexity.
- Use [CHARTING.md](./CHARTING.md) for the full contract surface, chart-specific guidance, and examples.

# Usage

```tsx
import {
  BarChart,
  DonutChart,
  FlameGraph,
  Heatmap,
  ProgressMeter,
  Sparkline,
  StackedBarChart,
  Timeline,
} from "@askrjs/askr-charts/components";
import "@askrjs/askr-charts/default";

export function AnalyticsPreview() {
  return (
    <div>
      <BarChart
        label="Monthly revenue"
        animate
        data={[
          { label: "Jan", value: 42 },
          { label: "Feb", value: 61 },
          { label: "Mar", value: 38 },
        ]}
      />

      <DonutChart
        label="Traffic split"
        animation={{ type: "sweep", duration: 360, stagger: 24 }}
        data={[
          { label: "Direct", value: 44 },
          { label: "Referral", value: 21 },
          { label: "Social", value: 35 },
        ]}
      />

      <FlameGraph
        label="Request stack"
        animate
        data={[
          {
            label: "renderApp",
            value: 120,
            children: [
              { label: "loadRoute", value: 44 },
              {
                label: "renderDashboard",
                value: 76,
                children: [
                  { label: "renderWidgets", value: 52 },
                  { label: "formatSummary", value: 24 },
                ],
              },
            ],
          },
        ]}
      />

      <Heatmap
        label="Weekly activity"
        animation={{ type: "fade", duration: 200, stagger: 4 }}
        data={[
          { x: "Mon", y: "Week 1", value: 8 },
          { x: "Tue", y: "Week 1", value: 4 },
          { x: "Wed", y: "Week 1", value: 10 },
        ]}
      />

      <ProgressMeter label="Quarterly quota" value={72} max={100} animate />

      <Sparkline
        label="Support trend"
        animation={{ type: "fade", duration: 180, stagger: 12 }}
        data={[
          { label: "Mon", value: 12 },
          { label: "Tue", value: 8 },
          { label: "Wed", value: 15 },
        ]}
      />

      <StackedBarChart
        label="Pipeline mix"
        animate
        data={[
          {
            label: "Q1",
            segments: [
              { label: "Open", value: 12 },
              { label: "Won", value: 8 },
              { label: "Lost", value: 4 },
            ],
          },
        ]}
      />

      <Timeline
        label="Release timeline"
        animation={{ type: "slide", duration: 280, stagger: 40 }}
        data={[
          { label: "Alpha", value: "Jan", description: "Internal preview" },
          { label: "Beta", value: "Feb", description: "Team rollout" },
          { label: "GA", value: "Mar", description: "Public launch" },
        ]}
      />
    </div>
  );
}
```

## Animation API

Every v1 chart accepts `animate?: boolean` and `animation?: ChartAnimation`.

```tsx
<BarChart data={data} animate />

<Heatmap
  data={data}
  animation={{
    type: "fade",
    duration: 200,
    delay: 0,
    stagger: 4,
    easing: "ease-out",
  }}
/>
```

Supported animation types:

- `grow`
- `fade`
- `scale`
- `sweep`
- `slide`
- `none`

Default chart animations:

- `BarChart`: `grow`
- `StackedBarChart`: `grow`
- `DonutChart`: `sweep`
- `FlameGraph`: `grow`
- `Heatmap`: `fade`
- `ProgressMeter`: `grow`
- `Timeline`: `slide`
- `Sparkline`: `fade`

Reduced-motion behavior:

- `prefers-reduced-motion: reduce` disables chart transitions and animations.
- Charts remain readable before, during, and after animation because motion is decorative only.

CSS variable contract:

- `--ak-chart-animation-duration`
- `--ak-chart-animation-delay`
- `--ak-chart-animation-stagger`
- `--ak-chart-animation-easing`
- `--ak-chart-item-index`

SSR output includes `data-ak-animate`, `data-ak-animation`, and the animation
CSS variables on the chart root so no mount-time JavaScript is required.

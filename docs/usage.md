# Usage

```tsx
import {
  BarChart,
  DonutChart,
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
        data={[
          { label: "Jan", value: 42 },
          { label: "Feb", value: 61 },
          { label: "Mar", value: 38 },
        ]}
      />

      <DonutChart
        label="Traffic split"
        data={[
          { label: "Direct", value: 44 },
          { label: "Referral", value: 21 },
          { label: "Social", value: 35 },
        ]}
      />

      <Heatmap
        label="Weekly activity"
        data={[
          { x: "Mon", y: "Week 1", value: 8 },
          { x: "Tue", y: "Week 1", value: 4 },
          { x: "Wed", y: "Week 1", value: 10 },
        ]}
      />

      <ProgressMeter label="Quarterly quota" value={72} max={100} />

      <Sparkline
        label="Support trend"
        data={[
          { label: "Mon", value: 12 },
          { label: "Tue", value: 8 },
          { label: "Wed", value: 15 },
        ]}
      />

      <StackedBarChart
        label="Pipeline mix"
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

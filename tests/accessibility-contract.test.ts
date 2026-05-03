import { describe, expect, it } from "vite-plus/test";
import { renderToStringSync } from "@askrjs/askr/ssr";

import {
  AreaChart,
  BarChart,
  DonutChart,
  FlameGraph,
  Heatmap,
  LineChart,
  ProgressMeter,
  RadialGauge,
  Sparkline,
  StackedBarChart,
  Timeline,
} from "../src/components";

function renderChart(render: () => unknown): string {
  return renderToStringSync(() => render());
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

describe("accessibility contract", () => {
  it("should expose role img and fallback table content for visual charts", () => {
    const charts = [
      renderChart(() =>
        AreaChart({
          label: "Weekly orders",
          data: [{ label: "Mon", value: 18, description: "Launch week" }],
        }),
      ),
      renderChart(() =>
        BarChart({
          label: "Monthly revenue",
          data: [{ label: "Jan", value: 42, description: "Opening month" }],
        }),
      ),
      renderChart(() =>
        DonutChart({
          label: "Traffic split",
          data: [{ label: "Direct", value: 64, description: "Homepage traffic" }],
        }),
      ),
      renderChart(() =>
        FlameGraph({
          label: "Call stack",
          data: [
            {
              label: "renderApp",
              value: 90,
              description: "Top-level frame",
              children: [{ label: "loadRoute", value: 40, description: "Data boot" }],
            },
          ],
        }),
      ),
      renderChart(() =>
        Heatmap({
          label: "Weekly activity",
          data: [{ x: "Mon", y: "Week 1", value: 8, description: "Support load" }],
        }),
      ),
      renderChart(() =>
        LineChart({
          label: "Weekly signups",
          data: [{ label: "Mon", value: 12, description: "Campaign lift" }],
        }),
      ),
      renderChart(() =>
        Sparkline({
          label: "Response trend",
          data: [{ label: "Mon", value: 12, description: "Average response" }],
        }),
      ),
      renderChart(() =>
        RadialGauge({
          label: "Fill rate",
          value: 68,
          max: 100,
          description: "Current utilization",
        }),
      ),
      renderChart(() =>
        StackedBarChart({
          label: "Pipeline mix",
          data: [
            {
              label: "Q1",
              segments: [{ label: "Open", value: 12, description: "Carryover" }],
            },
          ],
        }),
      ),
      renderChart(() =>
        Timeline({
          label: "Release timeline",
          data: [{ label: "Alpha", value: "Jan", description: "Internal preview" }],
        }),
      ),
    ];

    for (const chart of charts) {
      expect(chart).toContain('role="img"');
      expect(chart).toContain("aria-label=");
      expect(chart).toContain('data-slot="chart-summary"');
      expect(chart).toContain('data-slot="chart-table"');
      expect(chart).toContain("ak-chart-sr-only");
    }
  });

  it("should expose semantic meter attributes for progress meters", () => {
    const chart = renderChart(() =>
      ProgressMeter({
        label: "Quota progress",
        value: 48,
        max: 80,
        description: "Current quarter attainment",
      }),
    );

    expect(chart).toContain('role="meter"');
    expect(chart).toContain('aria-valuemin="0"');
    expect(chart).toContain('aria-valuemax="80"');
    expect(chart).toContain('aria-valuenow="48"');
    expect(chart).toContain('aria-valuetext="60%"');
    expect(chart).toContain('data-slot="chart-summary"');
  });

  it("should include labelled data items for list-driven chart structures", () => {
    const barChart = renderChart(() =>
      BarChart({
        label: "Revenue",
        data: [
          { label: "Jan", value: 10 },
          { label: "Feb", value: 12 },
        ],
      }),
    );
    const timeline = renderChart(() =>
      Timeline({
        label: "Release timeline",
        data: [
          { label: "Alpha", value: "Jan" },
          { label: "GA", value: "Mar" },
        ],
      }),
    );

    expect(countOccurrences(barChart, 'data-slot="bar-chart-item"')).toBe(2);
    expect(countOccurrences(timeline, 'data-slot="timeline-item"')).toBe(2);
  });
});

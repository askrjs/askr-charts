import { describe, expect, it } from "vite-plus/test";
import { renderToStringSync } from "@askrjs/askr/ssr";

import {
  BarChart,
  ChartEmptyState,
  ChartLegend,
  ChartPanel,
  ChartShell,
  DonutChart,
  FlameGraph,
  Heatmap,
  ProgressMeter,
  Sparkline,
  StackedBarChart,
  Timeline,
} from "../src/components";

describe("components entrypoint", () => {
  it("exposes chart layout primitives from one barrel", () => {
    expect(typeof ChartShell).toBe("function");
    expect(typeof BarChart).toBe("function");
    expect(typeof DonutChart).toBe("function");
    expect(typeof FlameGraph).toBe("function");
    expect(typeof Heatmap).toBe("function");
    expect(typeof ProgressMeter).toBe("function");
    expect(typeof Sparkline).toBe("function");
    expect(typeof StackedBarChart).toBe("function");
    expect(typeof Timeline).toBe("function");
    expect(ChartShell({ title: "Traffic", children: "canvas" })).toBeTruthy();
    expect(ChartPanel({ title: "Revenue", children: "chart" })).toBeTruthy();
    expect(ChartEmptyState({ title: "No data", description: "Add a dataset" })).toBeTruthy();
    expect(
      renderToStringSync(() =>
        BarChart({ label: "Monthly revenue", data: [{ label: "Jan", value: 42 }] }),
      ),
    ).toContain('data-slot="bar-chart"');
    expect(
      renderToStringSync(() =>
        DonutChart({ label: "Traffic split", data: [{ label: "Direct", value: 64 }] }),
      ),
    ).toContain('data-slot="donut-chart"');
    expect(
      renderToStringSync(() =>
        FlameGraph({
          label: "Call stack",
          data: [{ label: "render", value: 64, children: [{ label: "load", value: 32 }] }],
        }),
      ),
    ).toContain('data-slot="flame-graph"');
    expect(
      renderToStringSync(() =>
        Heatmap({ label: "Weekly activity", data: [{ x: "Mon", y: "Week 1", value: 8 }] }),
      ),
    ).toContain('data-slot="heatmap"');
    expect(ProgressMeter({ label: "Adoption", value: 72, max: 100 })).toBeTruthy();
    expect(
      renderToStringSync(() => Sparkline({ label: "Trend", data: [{ label: "Mon", value: 8 }] })),
    ).toContain('data-slot="sparkline"');
    expect(
      renderToStringSync(() =>
        StackedBarChart({
          label: "Pipeline mix",
          data: [{ label: "Q1", segments: [{ label: "Open", value: 12 }] }],
        }),
      ),
    ).toContain('data-slot="stacked-bar-chart"');
    expect(
      renderToStringSync(() =>
        Timeline({ label: "Release timeline", data: [{ label: "Alpha", value: "Jan" }] }),
      ),
    ).toContain('data-slot="timeline"');
    expect(
      renderToStringSync(() =>
        ChartLegend({
          title: "Series",
          items: [{ label: "Series A", color: "#2563eb", value: "42%" }],
        }),
      ),
    ).toContain('data-slot="chart-legend-item"');
  });
});

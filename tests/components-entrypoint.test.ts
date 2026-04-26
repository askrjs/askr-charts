import { describe, expect, it } from "vite-plus/test";

import {
  BarChart,
  ChartEmptyState,
  ChartLegend,
  ChartPanel,
  ChartShell,
  DonutChart,
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
    expect(typeof Heatmap).toBe("function");
    expect(typeof ProgressMeter).toBe("function");
    expect(typeof Sparkline).toBe("function");
    expect(typeof StackedBarChart).toBe("function");
    expect(typeof Timeline).toBe("function");
    expect(ChartShell({ title: "Traffic", children: "canvas" })).toBeTruthy();
    expect(ChartPanel({ title: "Revenue", children: "chart" })).toBeTruthy();
    expect(
      ChartLegend({
        title: "Series",
        items: [{ label: "Series A", color: "#2563eb", value: "42%" }],
      }),
    ).toBeTruthy();
    expect(ChartEmptyState({ title: "No data", description: "Add a dataset" })).toBeTruthy();
    expect(
      BarChart({
        label: "Monthly revenue",
        data: [{ label: "Jan", value: 42 }],
      }),
    ).toBeTruthy();
    expect(
      DonutChart({
        label: "Traffic split",
        data: [{ label: "Direct", value: 64 }],
      }),
    ).toBeTruthy();
    expect(
      Heatmap({
        label: "Weekly activity",
        data: [{ x: "Mon", y: "Week 1", value: 8 }],
      }),
    ).toBeTruthy();
    expect(ProgressMeter({ label: "Adoption", value: 72, max: 100 })).toBeTruthy();
    expect(
      Sparkline({
        label: "Trend",
        data: [{ label: "Mon", value: 8 }],
      }),
    ).toBeTruthy();
    expect(
      StackedBarChart({
        label: "Pipeline mix",
        data: [{ label: "Q1", segments: [{ label: "Open", value: 12 }] }],
      }),
    ).toBeTruthy();
    expect(
      Timeline({
        label: "Release timeline",
        data: [{ label: "Alpha", value: "Jan" }],
      }),
    ).toBeTruthy();
  });
});

import { describe, expect, it } from "vite-plus/test";

import {
  BarChart,
  DonutChart,
  Heatmap,
  ProgressMeter,
  Sparkline,
  StackedBarChart,
  Timeline,
} from "../src/components";

describe("chart components", () => {
  it("renders a bar chart with semantic root hooks and fallback content", () => {
    const chart = BarChart({
      label: "Monthly revenue",
      data: [
        { label: "Jan", value: 42 },
        { label: "Feb", value: 18 },
      ],
    }) as { type: string; props: Record<string, unknown> };

    expect(chart.type).toBe("section");
    expect(chart.props["data-slot"]).toBe("bar-chart");
    expect(String(chart.props.className)).toContain("ak-bar-chart");
  });

  it("renders a donut chart with CSS-variable gradient stops", () => {
    const chart = DonutChart({
      label: "Traffic split",
      data: [
        { label: "Direct", value: 50 },
        { label: "Referral", value: 50 },
      ],
    }) as { props: Record<string, unknown> };
    const style = chart.props.style as Record<string, unknown>;

    expect(chart.props["data-slot"]).toBe("donut-chart");
    expect(String(style["--ak-chart-donut-stops"])).toContain("deg");
  });

  it("renders a heatmap with CSS variable grid sizing", () => {
    const chart = Heatmap({
      label: "Activity heatmap",
      data: [
        { x: "Mon", y: "Week 1", value: 8 },
        { x: "Tue", y: "Week 1", value: 4 },
      ],
    }) as { props: Record<string, unknown> };
    const style = chart.props.style as Record<string, unknown>;

    expect(chart.props["data-slot"]).toBe("heatmap");
    expect(style["--ak-heatmap-columns"]).toBe(2);
  });

  it("renders a progress meter with semantic meter attributes", () => {
    const chart = ProgressMeter({
      label: "Quota progress",
      value: 48,
      max: 80,
    }) as { props: Record<string, unknown> };

    expect(chart.props["data-slot"]).toBe("progress-meter");
    expect(
      String(
        chart.props.style &&
          (chart.props.style as Record<string, unknown>)["--ak-chart-item-value"],
      ),
    ).toContain("%");
  });

  it("renders a sparkline with column layout points", () => {
    const chart = Sparkline({
      label: "Response time trend",
      data: [
        { label: "Mon", value: 8 },
        { label: "Tue", value: 4 },
      ],
    }) as { props: Record<string, unknown> };

    expect(chart.props["data-slot"]).toBe("sparkline");
  });

  it("renders a stacked bar chart with stacked segments", () => {
    const chart = StackedBarChart({
      label: "Pipeline mix",
      data: [
        {
          label: "Q1",
          segments: [
            { label: "Open", value: 12 },
            { label: "Won", value: 8 },
          ],
        },
      ],
    }) as { props: Record<string, unknown> };

    expect(chart.props["data-slot"]).toBe("stacked-bar-chart");
  });

  it("renders a timeline with semantic item hooks", () => {
    const chart = Timeline({
      label: "Release timeline",
      data: [
        { label: "Alpha", value: "Jan" },
        { label: "Beta", value: "Feb" },
      ],
    }) as { props: Record<string, unknown> };

    expect(chart.props["data-slot"]).toBe("timeline");
  });
});

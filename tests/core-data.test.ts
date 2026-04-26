import { describe, expect, it } from "vite-plus/test";

import {
  buildDonutStops,
  buildHeatmapSummary,
  buildValueChartSummary,
  clampChartValue,
  createHeatmapLegendItems,
  createValueChartLegendItems,
  getValueChartMin,
  getValueChartMax,
  normalizeHeatmapData,
  normalizeValueChartData,
  toChartFraction,
} from "../src/core";

describe("core data contract", () => {
  it("should clamp negative and invalid values before chart normalization", () => {
    expect(clampChartValue(-4)).toBe(0);
    expect(clampChartValue(Number.NaN)).toBe(0);
    expect(clampChartValue(12)).toBe(12);
  });

  it("should normalize value chart data against the detected max", () => {
    const normalized = normalizeValueChartData([
      { label: "Jan", value: 50 },
      { label: "Feb", value: -20 },
    ]);

    expect(normalized.max).toBe(50);
    expect(normalized.min).toBe(0);
    expect(normalized.data[0]?.fraction).toBe(1);
    expect(normalized.data[1]?.value).toBe(0);
    expect(normalized.data[1]?.fraction).toBe(0);
  });

  it("should accept tuple inputs and explicit minimums for value charts", () => {
    const normalized = normalizeValueChartData(
      [
        ["Jan", 20],
        ["Feb", 40],
      ],
      { min: 20, max: 40 },
    );

    expect(normalized.min).toBe(20);
    expect(normalized.data[0]?.fraction).toBe(0);
    expect(normalized.data[1]?.fraction).toBe(1);
  });

  it("should build donut stops from normalized segments", () => {
    const normalized = normalizeValueChartData([
      { label: "Direct", value: 30 },
      { label: "Referral", value: 70 },
    ]).data;

    const stops = buildDonutStops(normalized);
    expect(stops).toContain("0deg");
    expect(stops).toContain("360deg");
  });

  it("should normalize heatmap data into ordered axes and mixed backgrounds", () => {
    const normalized = normalizeHeatmapData([
      { x: "Mon", y: "Week 1", value: 8 },
      { x: "Tue", y: "Week 1", value: 4 },
      { x: "Mon", y: "Week 2", value: 2 },
    ]);

    expect(normalized.columns).toEqual(["Mon", "Tue"]);
    expect(normalized.rows).toEqual(["Week 1", "Week 2"]);
    expect(normalized.min).toBe(0);
    expect(normalized.cells[0]?.background).toContain("color-mix");
  });

  it("should accept tuple inputs and explicit minimums for heatmaps", () => {
    const normalized = normalizeHeatmapData(
      [
        ["Mon", "Week 1", 2],
        ["Tue", "Week 1", 8],
      ],
      { min: 2, max: 8 },
    );

    expect(normalized.min).toBe(2);
    expect(normalized.cells[0]?.fraction).toBe(0);
    expect(normalized.cells[1]?.fraction).toBe(1);
  });

  it("should build summaries that stay readable in plain text", () => {
    const valueData = normalizeValueChartData([
      { label: "Jan", value: 20 },
      { label: "Feb", value: 40 },
    ]);
    const heatmapData = normalizeHeatmapData([
      { x: "Mon", y: "Week 1", value: 8 },
      { x: "Tue", y: "Week 1", value: 4 },
    ]);

    expect(buildValueChartSummary("Revenue", valueData.data, valueData.max)).toContain(
      "Highest value",
    );
    expect(buildHeatmapSummary("Activity", heatmapData.cells, heatmapData.max)).toContain(
      "Peak value",
    );
  });

  it("should keep scale helpers predictable", () => {
    expect(getValueChartMin([{ label: "A", value: 5 }], 2)).toBe(2);
    expect(getValueChartMax([{ label: "A", value: 5 }], 12)).toBe(12);
    expect(toChartFraction(25, 100)).toBe(0.25);
    expect(toChartFraction(25, 100, 20)).toBe(0.0625);
    expect(toChartFraction(25, 0)).toBe(0);
  });

  it("should derive chart legend items from value chart data", () => {
    const items = createValueChartLegendItems([
      { label: "Direct", value: 30 },
      { label: "Referral", value: 70, color: "tomato" },
    ]);

    expect(items).toEqual([
      { label: "Direct", value: "30", color: "var(--ak-chart-series-1)" },
      { label: "Referral", value: "70", color: "tomato" },
    ]);
  });

  it("should derive heatmap legend ranges from heatmap data", () => {
    const items = createHeatmapLegendItems(
      [
        { x: "Mon", y: "Week 1", value: 2 },
        { x: "Tue", y: "Week 1", value: 8 },
      ],
      { steps: 3 },
    );

    expect(items).toHaveLength(3);
    expect(items[0]?.label).toBe("0-2.667");
    expect(items[2]?.color).toContain("color-mix");
  });
});

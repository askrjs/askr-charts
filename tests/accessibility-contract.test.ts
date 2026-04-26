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

type ElementNode = {
  type: unknown;
  props: Record<string, unknown>;
  key?: string | number | null;
};

function isElementNode(value: unknown): value is ElementNode {
  return Boolean(
    value &&
    typeof value === "object" &&
    "props" in (value as Record<string, unknown>) &&
    "type" in (value as Record<string, unknown>),
  );
}

function toChildrenArray(children: unknown): unknown[] {
  if (children == null) return [];
  return Array.isArray(children) ? children : [children];
}

function findFirst(node: unknown, predicate: (node: ElementNode) => boolean): ElementNode | null {
  if (!isElementNode(node)) return null;
  if (predicate(node)) return node;

  for (const child of toChildrenArray(node.props.children)) {
    const match = findFirst(child, predicate);
    if (match) return match;
  }

  return null;
}

function findAll(node: unknown, predicate: (node: ElementNode) => boolean): ElementNode[] {
  if (!isElementNode(node)) return [];

  const matches = predicate(node) ? [node] : [];
  for (const child of toChildrenArray(node.props.children)) {
    matches.push(...findAll(child, predicate));
  }

  return matches;
}

describe("accessibility contract", () => {
  it("should expose role img and fallback table content for visual charts", () => {
    const charts = [
      BarChart({
        label: "Monthly revenue",
        data: [{ label: "Jan", value: 42, description: "Opening month" }],
      }),
      DonutChart({
        label: "Traffic split",
        data: [{ label: "Direct", value: 64, description: "Homepage traffic" }],
      }),
      Heatmap({
        label: "Weekly activity",
        data: [{ x: "Mon", y: "Week 1", value: 8, description: "Support load" }],
      }),
      Sparkline({
        label: "Response trend",
        data: [{ label: "Mon", value: 12, description: "Average response" }],
      }),
      StackedBarChart({
        label: "Pipeline mix",
        data: [
          {
            label: "Q1",
            segments: [{ label: "Open", value: 12, description: "Carryover" }],
          },
        ],
      }),
      Timeline({
        label: "Release timeline",
        data: [{ label: "Alpha", value: "Jan", description: "Internal preview" }],
      }),
    ];

    for (const chart of charts) {
      const graphic = findFirst(chart, (node) => node.props["role"] === "img");
      const summary = findFirst(chart, (node) => node.props["data-slot"] === "chart-summary");
      const table = findFirst(chart, (node) => node.props["data-slot"] === "chart-table");

      expect(graphic).toBeTruthy();
      expect(typeof graphic?.props["aria-label"]).toBe("string");
      expect(summary).toBeTruthy();
      expect(table?.type).toBe("table");
      expect(String(table?.props.className)).toContain("ak-chart-sr-only");
    }
  });

  it("should expose semantic meter attributes for progress meters", () => {
    const chart = ProgressMeter({
      label: "Quota progress",
      value: 48,
      max: 80,
      description: "Current quarter attainment",
    });

    const meter = findFirst(chart, (node) => node.props["role"] === "meter");
    const summary = findFirst(chart, (node) => node.props["data-slot"] === "chart-summary");

    expect(meter).toBeTruthy();
    expect(meter?.props["aria-valuemin"]).toBe(0);
    expect(meter?.props["aria-valuemax"]).toBe(80);
    expect(meter?.props["aria-valuenow"]).toBe(48);
    expect(String(meter?.props["aria-valuetext"]).includes("%")).toBe(true);
    expect(summary).toBeTruthy();
  });

  it("should include labelled data items for list-driven chart structures", () => {
    const barChart = BarChart({
      label: "Revenue",
      data: [
        { label: "Jan", value: 10 },
        { label: "Feb", value: 12 },
      ],
    });
    const timeline = Timeline({
      label: "Release timeline",
      data: [
        { label: "Alpha", value: "Jan" },
        { label: "GA", value: "Mar" },
      ],
    });

    const barItems = findAll(barChart, (node) => node.props["data-slot"] === "bar-chart-item");
    const timelineItems = findAll(timeline, (node) => node.props["data-slot"] === "timeline-item");

    expect(barItems).toHaveLength(2);
    expect(timelineItems).toHaveLength(2);
  });
});

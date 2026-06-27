import { afterEach, describe, expect, it } from "vite-plus/test";

import { cleanupApp, createIsland } from "@askrjs/askr/boot";

import {
  AreaChart,
  BarChart,
  ChartEmptyState,
  ChartLegend,
  ChartPanel,
  ChartShell,
  DonutChart,
  FlameGraph,
  Heatmap,
  LineChart,
  PieChart,
  ProgressMeter,
  RadialGauge,
  Sparkline,
  StackedBarChart,
  Timeline,
} from "../../src/components";

function mount(element: JSX.Element): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  createIsland({
    root: container,
    component: () => element,
  });
  return container;
}

async function flushUpdates(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function unmount(container: HTMLElement | undefined) {
  if (container) {
    cleanupApp(container);
  }

  if (container?.parentNode) {
    container.parentNode.removeChild(container);
  }
}

function expectElement<T extends Element>(element: T | null): T {
  expect(element).toBeTruthy();
  return element as T;
}

function assertVisibleBox(element: Element, label: string) {
  const box = element.getBoundingClientRect();
  expect(box.width, `${label} should have visible width`).toBeGreaterThan(0);
  expect(box.height, `${label} should have visible height`).toBeGreaterThan(0);
}

function assertPaintedMark(element: HTMLElement, label: string) {
  const styles = getComputedStyle(element);
  expect(
    styles.backgroundColor !== "rgba(0, 0, 0, 0)" || styles.backgroundImage !== "none",
    `${label} should have a visible paint source`,
  ).toBe(true);
}

const valueData = [
  { label: "API gateway", value: 42, description: "Public traffic" },
  { label: "Route loader", value: 64, description: "Data hydration" },
  { label: "Theme pass", value: 28, description: "Style work" },
  { label: "Idle budget", value: 12, description: "Headroom" },
];

const longLabelData = [
  { label: "Authentication route with a deliberately long label", value: 18 },
  { label: "Metrics overview with narrow space", value: 34 },
  { label: "Logs explorer virtual rows", value: 27 },
  { label: "Settings and preferences", value: 7 },
];

function ChartAuditMatrix() {
  return (
    <div
      data-theme="light"
      style={{
        "--ak-color-bg": "rgb(255, 255, 255)",
        "--ak-color-surface": "rgb(255, 255, 255)",
        "--ak-color-surface-muted": "rgb(247, 247, 247)",
        "--ak-color-surface-raised": "rgb(255, 255, 255)",
        "--ak-color-border": "rgb(229, 229, 229)",
        "--ak-color-text": "rgb(24, 24, 27)",
        "--ak-color-text-muted": "rgb(82, 82, 91)",
        "--ak-color-focus-ring": "rgb(82, 82, 91)",
        "--ak-radius-sm": "6px",
        "--ak-radius-md": "8px",
        "--ak-radius-xl": "12px",
        "--ak-space-lg": "18px",
        "--ak-space-xl": "24px",
        "--ak-layout-panel-padding": "18px",
        inlineSize: "360px",
      }}
    >
      <ChartShell title="Chart audit" description="Every chart contract in one product surface">
        <ChartPanel title="Bars" description="Category comparison">
          <BarChart label="Route workload" data={longLabelData} />
        </ChartPanel>

        <ChartPanel title="Histogram" description="Latency distribution">
          <BarChart
            label="Response latency histogram"
            variant="histogram"
            data={[
              { label: "0-50ms", value: 18 },
              { label: "51-100ms", value: 34 },
              { label: "101-200ms", value: 29 },
              { label: "400ms+", value: 6 },
            ]}
          />
        </ChartPanel>

        <ChartPanel title="Stacked bars" description="Total and composition">
          <StackedBarChart
            label="Pipeline mix"
            data={[
              {
                label: "Q1",
                segments: [
                  { label: "Open", value: 12 },
                  { label: "Won", value: 9 },
                  { label: "Lost", value: 2 },
                ],
              },
              {
                label: "Q2",
                segments: [
                  { label: "Open", value: 18 },
                  { label: "Won", value: 7 },
                  { label: "Lost", value: 0 },
                ],
              },
            ]}
          />
        </ChartPanel>

        <ChartPanel title="Line" description="Bounded reliability trend">
          <LineChart
            label="Weekly reliability"
            min={99.5}
            max={100}
            showGrid
            data={[
              { label: "Mon", value: 99.7 },
              { label: "Tue", value: 99.82 },
              { label: "Wed", value: 99.76 },
              { label: "Thu", value: 99.91 },
              { label: "Fri", value: 99.86 },
            ]}
          />
        </ChartPanel>

        <ChartPanel title="Area" description="Filled operational trend">
          <AreaChart label="Orders" data={valueData} />
        </ChartPanel>

        <ChartPanel title="Sparkline" description="Dense stat trend">
          <Sparkline label="Response trend" variant="line" data={valueData} />
        </ChartPanel>

        <ChartPanel title="Donut" description="Part-to-whole with total">
          <DonutChart label="Subsystem mix" totalLabel="Events" data={valueData} />
        </ChartPanel>

        <ChartPanel title="Pie" description="Solid share">
          <PieChart label="Issue share" data={valueData} />
        </ChartPanel>

        <ChartPanel title="Radial" description="Bounded scalar">
          <RadialGauge label="SLO" value={87} max={100} description="Current target" />
        </ChartPanel>

        <ChartPanel title="Progress" description="Linear bounded scalar">
          <ProgressMeter label="Rollout" value={48} max={80} description="Stable cohorts" />
        </ChartPanel>

        <ChartPanel title="Heatmap" description="Categorical intensity">
          <Heatmap
            label="Weekly activity"
            data={[
              { x: "Mon", y: "Week 1", value: 8 },
              { x: "Tue", y: "Week 1", value: 4 },
              { x: "Wed", y: "Week 1", value: 10 },
              { x: "Mon", y: "Week 2", value: 2 },
              { x: "Wed", y: "Week 2", value: 7 },
            ]}
          />
        </ChartPanel>

        <ChartPanel title="Timeline" description="Operational milestones">
          <Timeline
            label="Release timeline"
            data={[
              { label: "Alpha", value: "Jan", description: "Internal preview", status: "info" },
              { label: "Beta", value: "Feb", description: "Team rollout", status: "warning" },
              { label: "GA", value: "Mar", description: "Public release", status: "success" },
            ]}
          />
        </ChartPanel>

        <ChartPanel title="Flame graph" description="Hierarchical cost">
          <FlameGraph
            label="Request trace"
            data={[
              {
                label: "request",
                value: 100,
                children: [
                  { label: "router", value: 22 },
                  {
                    label: "service",
                    value: 48,
                    children: [
                      { label: "cache", value: 14 },
                      { label: "database", value: 34 },
                    ],
                  },
                  { label: "render", value: 30 },
                ],
              },
            ]}
          />
        </ChartPanel>

        <ChartPanel title="Support primitives" description="Legend and empty state">
          <ChartLegend
            title="States"
            items={[
              { label: "Ready", value: "42", color: "var(--ak-chart-series-3)" },
              { label: "Watching", value: "8", color: "var(--ak-chart-series-4)" },
            ]}
          />
          <ChartEmptyState title="No incidents" description="Nothing needs attention." />
        </ChartPanel>
      </ChartShell>
    </div>
  );
}

describe("chart audit matrix", () => {
  let container: HTMLElement | undefined;

  afterEach(() => {
    unmount(container);
    container = undefined;
  });

  it("should render every chart contract with visible marks in an Askr-themed narrow panel", async () => {
    container = mount(<ChartAuditMatrix />);
    await flushUpdates();

    const shell = expectElement(container.querySelector<HTMLElement>('[data-slot="chart-shell"]'));
    const panel = expectElement(container.querySelector<HTMLElement>('[data-slot="chart-panel"]'));
    const graphic = expectElement(
      container.querySelector<HTMLElement>('[data-slot="chart-graphic"]'),
    );

    expect(getComputedStyle(shell).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(panel).borderRadius).toBe("12px");
    expect(getComputedStyle(graphic).backgroundColor).toBe("rgb(255, 255, 255)");
    expect(getComputedStyle(graphic).borderTopColor).toBe("rgb(229, 229, 229)");

    const markSelectors = [
      ['[data-slot="bar-chart-fill"]', "bar fill"],
      ['[data-ak-chart-variant="histogram"] [data-slot="bar-chart-fill"]', "histogram fill"],
      ['[data-slot="stacked-bar-chart-segment"]', "stacked segment"],
      ['[data-slot="line-chart-stroke"]', "line stroke"],
      ['[data-slot="area-chart-surface"]', "area surface"],
      ['[data-slot="sparkline-stroke"]', "sparkline stroke"],
      ['[data-slot="donut-chart-ring"]', "donut ring"],
      ['[data-slot="pie-chart-disc"]', "pie disc"],
      ['[data-slot="radial-gauge-ring"]', "radial gauge ring"],
      ['[data-slot="progress-meter-fill"]', "progress fill"],
      ['[data-slot="heatmap-cell"]', "heatmap cell"],
      ['[data-slot="timeline-marker"]', "timeline marker"],
      ['[data-slot="flame-graph-cell"]', "flame graph cell"],
    ] as const;

    for (const [selector, label] of markSelectors) {
      const mark = expectElement(container.querySelector<HTMLElement>(selector));
      assertVisibleBox(mark, label);
      assertPaintedMark(mark, label);
    }

    const panels = [...container.querySelectorAll<HTMLElement>('[data-slot="chart-panel"]')];
    expect(panels).toHaveLength(14);

    for (const currentPanel of panels) {
      expect(currentPanel.scrollWidth).toBeLessThanOrEqual(currentPanel.clientWidth + 1);
    }

    expect(container.querySelectorAll('[role="img"]')).toHaveLength(12);
    expect(container.querySelectorAll('[role="meter"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-slot="chart-table"]')).toHaveLength(12);
  });
});

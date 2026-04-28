import { afterEach, describe, expect, it } from "vite-plus/test";

import { cleanupApp, createIsland } from "@askrjs/askr";

import {
  BarChart,
  DonutChart,
  FlameGraph,
  Heatmap,
  ProgressMeter,
  Timeline,
} from "../src/components";

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

describe("browser chart rendering", () => {
  let container: HTMLElement | undefined;

  afterEach(() => {
    unmount(container);
    container = undefined;
  });

  it("should render bar charts into the browser DOM with labelled graphics and item widths", async () => {
    container = mount(
      <BarChart
        label="Monthly revenue"
        animate
        data={[
          { label: "Jan", value: 40 },
          { label: "Feb", value: 25 },
        ]}
      />,
    );
    await flushUpdates();

    const graphic = container.querySelector('[role="img"]');
    const items = [...container.querySelectorAll('[data-slot="bar-chart-item"]')];
    const firstFill = container.querySelector('[data-slot="bar-chart-fill"]');

    expect(graphic?.getAttribute("aria-label")).toBe("Monthly revenue");
    expect(items).toHaveLength(2);
    expect(
      container.querySelector('[data-slot="bar-chart"]')?.getAttribute("data-ak-animation"),
    ).toBe("grow");
    expect(items[0]?.getAttribute("style")).toContain("--ak-chart-item-value:100%");
    expect(items[1]?.getAttribute("style")).toContain("--ak-chart-item-value:62.5%");
    expect(items[0]?.getAttribute("style")).toContain("--ak-chart-item-index:0");
    expect(firstFill?.getAttribute("data-ak-chart-item")).toBe("true");
    expect(container.querySelector('[data-slot="chart-table"] caption')?.textContent).toBe(
      "Monthly revenue",
    );
  });

  it("should render heatmap grids with normalized column count and fallback cells", async () => {
    container = mount(
      <Heatmap
        label="Weekly activity"
        animate
        data={[
          { x: "Mon", y: "Week 1", value: 8 },
          { x: "Tue", y: "Week 1", value: 4 },
          { x: "Mon", y: "Week 2", value: 2 },
        ]}
      />,
    );
    await flushUpdates();

    const root = container.querySelector('[data-slot="heatmap"]');
    const cells = [...container.querySelectorAll('[data-slot="heatmap-cell"]')];

    expect(root?.getAttribute("style")).toContain("--ak-heatmap-columns:2");
    expect(root?.getAttribute("data-ak-animation")).toBe("fade");
    expect(cells).toHaveLength(4);
    expect(cells[0]?.getAttribute("aria-label")).toBe("Week 1, Mon: 8");
    expect(cells[0]?.getAttribute("style")).toContain("--ak-chart-item-index:0");
    expect(cells[3]?.getAttribute("aria-label")).toBe("Week 2, Tue: 0");
    expect(cells[3]?.getAttribute("style")).toContain("--ak-chart-item-index:3");
  });

  it("should render flame graph frames with positioned spans", async () => {
    container = mount(
      <FlameGraph
        label="Call stack"
        animate
        data={[
          {
            label: "renderApp",
            value: 100,
            children: [
              { label: "loadRoute", value: 40 },
              { label: "renderPage", value: 60 },
            ],
          },
        ]}
      />,
    );
    await flushUpdates();

    const root = container.querySelector('[data-slot="flame-graph"]');
    const cells = [...container.querySelectorAll('[data-slot="flame-graph-cell"]')];

    expect(root?.getAttribute("data-ak-animation")).toBe("grow");
    expect(cells).toHaveLength(3);
    expect(cells[0]?.getAttribute("style")).toContain("--ak-chart-item-offset:0%");
    expect(cells[0]?.getAttribute("style")).toContain("--ak-chart-item-value:100%");
    expect(cells[1]?.getAttribute("style")).toContain("--ak-chart-item-value:40%");
    expect(cells[2]?.getAttribute("style")).toContain("--ak-chart-item-offset:40%");
    expect(container.querySelector('[data-slot="chart-table"] caption')?.textContent).toBe(
      "Call stack",
    );
  });

  it("should render semantic progress meters with live meter metadata", async () => {
    container = mount(
      <ProgressMeter
        label="Quota progress"
        description="Current quarter attainment"
        animate
        value={48}
        max={80}
      />,
    );
    await flushUpdates();

    const root = container.querySelector('[data-slot="progress-meter"]');
    const meter = container.querySelector('[role="meter"]');
    const description = container.querySelector('[data-slot="progress-meter-description"]');
    const fill = container.querySelector('[data-slot="progress-meter-fill"]');

    expect(root?.getAttribute("style")).toContain("--ak-chart-item-value:60%");
    expect(root?.getAttribute("data-ak-animation")).toBe("grow");
    expect(meter?.getAttribute("aria-valuemin")).toBe("0");
    expect(meter?.getAttribute("aria-valuemax")).toBe("80");
    expect(meter?.getAttribute("aria-valuenow")).toBe("48");
    expect(meter?.getAttribute("aria-valuetext")).toBe("60%");
    expect(fill?.getAttribute("style")).toContain("--ak-chart-item-index:0");
    expect(description?.textContent).toBe("Current quarter attainment");
  });

  it("should keep zero values at zero width in live rendering", async () => {
    container = mount(<BarChart label="Zero revenue" data={[{ label: "Jan", value: 0 }]} />);
    await flushUpdates();

    const item = container.querySelector('[data-slot="bar-chart-item"]');

    expect(item?.getAttribute("style")).toContain("--ak-chart-item-value:0%");
    expect(item?.getAttribute("style")).toContain("--ak-chart-item-min-size:0");
  });

  it("should normalize tuple data and explicit minimums in live bar rendering", async () => {
    container = mount(
      <BarChart
        label="Monthly revenue"
        labelDensity="minimal"
        min={20}
        max={40}
        data={[
          ["Jan", 20],
          ["Feb", 40],
        ]}
      />,
    );
    await flushUpdates();

    const root = container.querySelector('[data-slot="bar-chart"]');
    const items = [...container.querySelectorAll('[data-slot="bar-chart-item"]')];

    expect(root?.getAttribute("data-ak-label-density")).toBe("minimal");
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute("style")).toContain("--ak-chart-item-value:0%");
    expect(items[1]?.getAttribute("style")).toContain("--ak-chart-item-value:100%");
  });

  it("should render CSS-only tooltip content on chart items", async () => {
    container = mount(
      <BarChart
        label="Monthly revenue"
        data={[{ label: "Jan", value: 40, description: "First month" }]}
      />,
    );
    await flushUpdates();

    const item = container.querySelector('[data-slot="bar-chart-item"]');
    const tooltip = container.querySelector('[data-slot="tooltip-content"]');
    const tooltipTitle = container.querySelector('.chart-tooltip-title');
    const tooltipValue = container.querySelector('.chart-tooltip-value');

    expect(item?.getAttribute("tabindex")).toBe("0");
    expect(tooltip).toBeTruthy();
    expect(tooltipTitle?.textContent).toBe("Jan");
    expect(tooltipValue?.textContent).toBe("40");
  });

  it("should render donut charts with live totals and tooltip-ready segments", async () => {
    container = mount(
      <DonutChart
        label="Traffic split"
        labelDensity="compact"
        animate
        data={[
          ["Direct", 44, "tomato", "Owned traffic"],
          ["Referral", 21],
          ["Social", 35],
        ]}
      />,
    );
    await flushUpdates();

    const root = container.querySelector('[data-slot="donut-chart"]');
    const ring = container.querySelector('[data-slot="donut-chart-ring"]');
    const ringSegments = [...container.querySelectorAll('[data-slot="donut-chart-segment"]')];
    const items = [...container.querySelectorAll('[data-slot="donut-chart-item"]')];
    const totalValue = container.querySelector('[data-slot="donut-chart-total-value"]');
    const tooltipTitle = container.querySelector('.chart-tooltip-title');

    expect(root?.getAttribute("data-ak-animation")).toBe("sweep");
    expect(root?.getAttribute("data-ak-label-density")).toBe("compact");
    expect(root?.getAttribute("style")).toContain("--ak-chart-donut-stops:");
    expect(ring?.getAttribute("style")).toContain("--ak-chart-item-index:0");
    expect(ringSegments).toHaveLength(3);
    expect(ringSegments[0]?.getAttribute("tabindex")).toBe("0");
    expect(ringSegments[0]?.getAttribute("style")).toContain("--ak-chart-item-color:tomato");
    expect(items).toHaveLength(3);
    expect(items[0]?.getAttribute("tabindex")).toBe("0");
    expect(items[0]?.getAttribute("style")).toContain("--ak-chart-item-color:tomato");
    expect(totalValue?.textContent).toBe("100");
    expect(tooltipTitle?.textContent).toBe("Direct");
  });

  it("should render timelines with slide animation and tooltip-ready milestones", async () => {
    container = mount(
      <Timeline
        label="Release timeline"
        labelDensity="compact"
        animate
        data={[
          { label: "Alpha", value: "Jan", description: "Internal preview", accentColor: "gold" },
          { label: "Beta", value: "Feb", description: "Team rollout" },
        ]}
      />,
    );
    await flushUpdates();

    const root = container.querySelector('[data-slot="timeline"]');
    const items = [...container.querySelectorAll('[data-slot="timeline-item"]')];
    const firstMarker = container.querySelector('[data-slot="timeline-marker"]');
    const tooltipTitle = container.querySelector('.chart-tooltip-title');
    const tooltipValue = container.querySelector('.chart-tooltip-value');

    expect(root?.getAttribute("data-ak-animation")).toBe("slide");
    expect(root?.getAttribute("data-ak-label-density")).toBe("compact");
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute("tabindex")).toBe("0");
    expect(items[0]?.getAttribute("style")).toContain("--ak-chart-item-color:gold");
    expect(items[0]?.getAttribute("style")).toContain("--ak-chart-item-index:0");
    expect(firstMarker).toBeTruthy();
    expect(tooltipTitle?.textContent).toBe("Alpha");
    expect(tooltipValue?.textContent).toBe("Jan");
    expect(container.querySelector('[data-slot="chart-table"] caption')?.textContent).toBe(
      "Release timeline",
    );
  });
});

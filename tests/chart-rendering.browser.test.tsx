import { afterEach, describe, expect, it } from "vite-plus/test";

import { cleanupApp, createIsland } from "@askrjs/askr";

import {
  AreaChart,
  BarChart,
  DonutChart,
  FlameGraph,
  Heatmap,
  LineChart,
  ProgressMeter,
  RadialGauge,
  StackedBarChart,
  Sparkline,
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

function normalizeStyle(style: string | null | undefined): string {
  return (style ?? "").replace(/\s*:\s*/g, ":").replace(/;\s*/g, ";");
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
    expect(normalizeStyle(items[0]?.getAttribute("style"))).toContain("--ak-chart-item-value:100%");
    expect(normalizeStyle(items[1]?.getAttribute("style"))).toContain(
      "--ak-chart-item-value:62.5%",
    );
    expect(normalizeStyle(items[0]?.getAttribute("style"))).toContain("--ak-chart-item-index:0");
    expect(firstFill?.getAttribute("data-ak-chart-item")).toBe("true");
    expect(container.querySelector('[data-slot="chart-table"] caption')?.textContent).toBe(
      "Monthly revenue",
    );
  });

  it("should align chart tooltips to the pointer inside the hovered trigger", async () => {
    container = mount(<BarChart label="Monthly revenue" data={[{ label: "Jan", value: 40 }]} />);
    await flushUpdates();

    const item = container.querySelector('[data-slot="bar-chart-item"]') as HTMLElement | null;
    expect(item).toBeTruthy();

    Object.defineProperty(item, "getBoundingClientRect", {
      value: () => ({
        bottom: 60,
        height: 40,
        left: 100,
        right: 300,
        top: 20,
        width: 200,
        x: 100,
        y: 20,
        toJSON: () => ({}),
      }),
    });

    const event = new Event("pointermove", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clientX", { value: 150 });
    Object.defineProperty(event, "clientY", { value: 40 });
    item.dispatchEvent(event);

    expect(normalizeStyle(item.getAttribute("style"))).toContain("--ak-chart-tooltip-x:150px");
    expect(normalizeStyle(item.getAttribute("style"))).toContain("--ak-chart-tooltip-y:26px");
  });

  it("should render line, area, and radial charts into the browser DOM", async () => {
    container = mount(
      <div>
        <LineChart
          label="Weekly signups"
          animate
          data={[
            { label: "Mon", value: 12 },
            { label: "Tue", value: 18 },
          ]}
        />
        <AreaChart
          label="Weekly orders"
          animate
          data={[
            { label: "Mon", value: 20 },
            { label: "Tue", value: 26 },
          ]}
        />
        <RadialGauge label="Fill rate" value={68} max={100} animate />
      </div>,
    );
    await flushUpdates();

    const line = container.querySelector('[data-slot="line-chart"]');
    const area = container.querySelector('[data-slot="area-chart"]');
    const radial = container.querySelector('[data-slot="radial-gauge"]');
    const lineStage = container.querySelector('[data-slot="line-chart-stage"]') as HTMLElement;
    const areaStage = container.querySelector('[data-slot="area-chart-stage"]') as HTMLElement;
    const areaGraphic = container.querySelector(
      '[data-slot="area-chart"] [data-slot="chart-graphic"]',
    ) as HTMLElement;

    expect(line?.getAttribute("data-ak-animation")).toBe("fade");
    expect(area?.getAttribute("data-ak-animation")).toBe("grow");
    expect(radial?.getAttribute("data-ak-animation")).toBe("sweep");
    expect(container.querySelector('[data-slot="line-chart-point"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="line-chart-fill"]')).toBeNull();
    expect(container.querySelector('[data-slot="area-chart-point"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="radial-gauge-ring"]')).toBeTruthy();
    expect(getComputedStyle(areaStage).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(areaStage).borderBottomStyle).toBe("solid");
    expect(getComputedStyle(lineStage).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(lineStage).borderBottomStyle).toBe("solid");
    expect(parseFloat(getComputedStyle(areaGraphic).minHeight)).toBeLessThanOrEqual(180);
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
    const firstCell = container.querySelector('[data-slot="heatmap-cell"]') as HTMLElement;

    expect(normalizeStyle(root?.getAttribute("style"))).toContain("--ak-heatmap-columns:2");
    expect(root?.getAttribute("data-ak-animation")).toBe("fade");
    expect(cells).toHaveLength(4);
    expect(cells[0]?.getAttribute("aria-label")).toBe("Week 1, Mon: 8");
    expect(normalizeStyle(cells[0]?.getAttribute("style"))).toContain("--ak-chart-item-index:0");
    expect(cells[3]?.getAttribute("aria-label")).toBe("Week 2, Tue: 0");
    expect(normalizeStyle(cells[3]?.getAttribute("style"))).toContain("--ak-chart-item-index:3");
    expect(parseFloat(getComputedStyle(firstCell).minInlineSize)).toBeLessThanOrEqual(30);
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
    expect(normalizeStyle(cells[0]?.getAttribute("style"))).toContain("--ak-chart-item-offset:0%");
    expect(normalizeStyle(cells[0]?.getAttribute("style"))).toContain("--ak-chart-item-value:100%");
    expect(normalizeStyle(cells[1]?.getAttribute("style"))).toContain("--ak-chart-item-value:40%");
    expect(normalizeStyle(cells[2]?.getAttribute("style"))).toContain("--ak-chart-item-offset:40%");
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

    expect(normalizeStyle(root?.getAttribute("style"))).toContain("--ak-chart-item-value:60%");
    expect(root?.getAttribute("data-ak-animation")).toBe("grow");
    expect(meter?.getAttribute("aria-valuemin")).toBe("0");
    expect(meter?.getAttribute("aria-valuemax")).toBe("80");
    expect(meter?.getAttribute("aria-valuenow")).toBe("48");
    expect(meter?.getAttribute("aria-valuetext")).toBe("60%");
    expect(normalizeStyle(fill?.getAttribute("style"))).toContain("--ak-chart-item-index:0");
    expect(description?.textContent).toBe("Current quarter attainment");
  });

  it("should render donut and radial charts with compact circular geometry", async () => {
    container = mount(
      <div>
        <DonutChart
          label="Traffic split"
          data={[
            { label: "Direct", value: 44 },
            { label: "Referral", value: 21 },
            { label: "Social", value: 35 },
          ]}
        />
        <RadialGauge label="Fill rate" value={68} max={100} />
      </div>,
    );
    await flushUpdates();

    const donutRing = container.querySelector('[data-slot="donut-chart-ring-wrap"]') as HTMLElement;
    const radialDial = container.querySelector('[data-slot="radial-gauge-dial"]') as HTMLElement;
    const donutItems = [...container.querySelectorAll('[data-slot="donut-chart-item"]')];

    expect(donutItems).toHaveLength(3);
    expect(parseFloat(getComputedStyle(donutRing).inlineSize)).toBeLessThanOrEqual(232);
    expect(parseFloat(getComputedStyle(radialDial).inlineSize)).toBeLessThanOrEqual(232);
  });

  it("should render stacked bar charts with compact track geometry", async () => {
    container = mount(
      <StackedBarChart
        label="Pipeline mix"
        data={[
          {
            label: "Q1",
            segments: [
              { label: "Open", value: 12 },
              { label: "Won", value: 9 },
            ],
          },
        ]}
      />,
    );
    await flushUpdates();

    const track = container.querySelector('[data-slot="stacked-bar-chart-track"]') as HTMLElement;
    const segments = [...container.querySelectorAll('[data-slot="stacked-bar-chart-segment"]')];

    expect(segments).toHaveLength(2);
    expect(parseFloat(getComputedStyle(track).minHeight)).toBeLessThanOrEqual(12);
  });

  it("should render sparkline and progress meter surfaces compactly", async () => {
    container = mount(
      <div>
        <Sparkline
          label="Response time trend"
          data={[
            { label: "Mon", value: 8 },
            { label: "Tue", value: 4 },
            { label: "Wed", value: 6 },
          ]}
        />
        <ProgressMeter label="Quota progress" value={48} max={80} />
      </div>,
    );
    await flushUpdates();

    const sparklineGraphic = container.querySelector('[data-slot="sparkline-list"]') as HTMLElement;
    const sparklineDot = container.querySelector('[data-slot="sparkline-dot"]') as HTMLElement;
    const progressTrack = container.querySelector(
      '[data-slot="progress-meter-track"]',
    ) as HTMLElement;

    expect(parseFloat(getComputedStyle(sparklineGraphic).minBlockSize)).toBeLessThanOrEqual(56);
    expect(parseFloat(getComputedStyle(sparklineDot).inlineSize)).toBeLessThanOrEqual(6);
    expect(parseFloat(getComputedStyle(progressTrack).minHeight)).toBeLessThanOrEqual(10);
  });

  it("should keep zero values at zero width in live rendering", async () => {
    container = mount(<BarChart label="Zero revenue" data={[{ label: "Jan", value: 0 }]} />);
    await flushUpdates();

    const item = container.querySelector('[data-slot="bar-chart-item"]');

    expect(normalizeStyle(item?.getAttribute("style"))).toContain("--ak-chart-item-value:0%");
    expect(normalizeStyle(item?.getAttribute("style"))).toContain("--ak-chart-item-min-size:0");
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
    expect(normalizeStyle(items[0]?.getAttribute("style"))).toContain("--ak-chart-item-value:0%");
    expect(normalizeStyle(items[1]?.getAttribute("style"))).toContain("--ak-chart-item-value:100%");
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
    const tooltipTitle = container.querySelector(".chart-tooltip-title");
    const tooltipValue = container.querySelector(".chart-tooltip-value");

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
    const tooltipTitle = container.querySelector(".chart-tooltip-title");

    expect(root?.getAttribute("data-ak-animation")).toBe("sweep");
    expect(root?.getAttribute("data-ak-label-density")).toBe("compact");
    expect(root?.getAttribute("style")).toContain("--ak-chart-donut-stops:");
    expect(normalizeStyle(ring?.getAttribute("style"))).toContain("--ak-chart-item-index:0");
    expect(ringSegments).toHaveLength(3);
    expect(ringSegments[0]?.getAttribute("tabindex")).toBe("0");
    expect(normalizeStyle(ringSegments[0]?.getAttribute("style"))).toContain(
      "--ak-chart-item-color:tomato",
    );
    expect(items).toHaveLength(3);
    expect(items[0]?.getAttribute("tabindex")).toBe("0");
    expect(normalizeStyle(items[0]?.getAttribute("style"))).toContain(
      "--ak-chart-item-color:tomato",
    );
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
    const list = container.querySelector('[data-slot="timeline-list"]') as HTMLElement;
    const firstMarker = container.querySelector('[data-slot="timeline-marker"]');
    const tooltipTitle = container.querySelector(".chart-tooltip-title");
    const tooltipValue = container.querySelector(".chart-tooltip-value");

    expect(root?.getAttribute("data-ak-animation")).toBe("slide");
    expect(root?.getAttribute("data-ak-label-density")).toBe("compact");
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute("tabindex")).toBe("0");
    expect(normalizeStyle(items[0]?.getAttribute("style"))).toContain("--ak-chart-item-color:gold");
    expect(normalizeStyle(items[0]?.getAttribute("style"))).toContain("--ak-chart-item-index:0");
    expect(firstMarker).toBeTruthy();
    expect(tooltipTitle?.textContent).toBe("Alpha");
    expect(tooltipValue?.textContent).toBe("Jan");
    expect(parseFloat(getComputedStyle(list).rowGap)).toBeLessThanOrEqual(12);
    expect(container.querySelector('[data-slot="chart-table"] caption')?.textContent).toBe(
      "Release timeline",
    );
  });
});

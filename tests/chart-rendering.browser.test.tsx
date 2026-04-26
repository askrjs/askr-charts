import { afterEach, describe, expect, it } from "vite-plus/test";

import { cleanupApp, createIsland } from "@askrjs/askr";

import { BarChart, FlameGraph, Heatmap, ProgressMeter } from "../src/components";

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
    expect(container.querySelector('[data-slot="bar-chart"]')?.getAttribute("data-ak-animation")).toBe(
      "grow",
    );
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
});
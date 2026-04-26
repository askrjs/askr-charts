import { afterEach, describe, expect, it } from "vite-plus/test";

import { cleanupApp, createIsland } from "@askrjs/askr";

import { BarChart, Heatmap, ProgressMeter } from "../src/components";

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
        data={[
          { label: "Jan", value: 40 },
          { label: "Feb", value: 25 },
        ]}
      />,
    );
    await flushUpdates();

    const graphic = container.querySelector('[role="img"]');
    const items = [...container.querySelectorAll('[data-slot="bar-chart-item"]')];

    expect(graphic?.getAttribute("aria-label")).toBe("Monthly revenue");
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute("style")).toContain("--ak-chart-item-value:100%");
    expect(items[1]?.getAttribute("style")).toContain("--ak-chart-item-value:62.5%");
    expect(container.querySelector('[data-slot="chart-table"] caption')?.textContent).toBe(
      "Monthly revenue",
    );
  });

  it("should render heatmap grids with normalized column count and fallback cells", async () => {
    container = mount(
      <Heatmap
        label="Weekly activity"
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
    expect(cells).toHaveLength(4);
    expect(cells[0]?.getAttribute("aria-label")).toBe("Week 1, Mon: 8");
    expect(cells[3]?.getAttribute("aria-label")).toBe("Week 2, Tue: 0");
  });

  it("should render semantic progress meters with live meter metadata", async () => {
    container = mount(
      <ProgressMeter
        label="Quota progress"
        description="Current quarter attainment"
        value={48}
        max={80}
      />,
    );
    await flushUpdates();

    const root = container.querySelector('[data-slot="progress-meter"]');
    const meter = container.querySelector('[role="meter"]');
    const description = container.querySelector('[data-slot="progress-meter-description"]');

    expect(root?.getAttribute("style")).toContain("--ak-chart-item-value:60%");
    expect(meter?.getAttribute("aria-valuemin")).toBe("0");
    expect(meter?.getAttribute("aria-valuemax")).toBe("80");
    expect(meter?.getAttribute("aria-valuenow")).toBe("48");
    expect(meter?.getAttribute("aria-valuetext")).toBe("60%");
    expect(description?.textContent).toBe("Current quarter attainment");
  });
});
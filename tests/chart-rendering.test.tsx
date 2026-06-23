import { afterEach, describe, expect, it } from "vite-plus/test";

import { cleanupApp, createIsland } from "@askrjs/askr/boot";

import { BarChart, StackedBarChart } from "../src/components";

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

describe("chart rendering in jsdom", () => {
  let container: HTMLElement | undefined;

  afterEach(() => {
    unmount(container);
    container = undefined;
  });

  it("should renders bar charts into the jsdom DOM with labelled graphics and item widths", async () => {
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

  it("should renders stacked bar fallback table rows without nested child scopes", async () => {
    container = mount(
      <StackedBarChart
        label="Messages"
        data={[
          {
            label: "Inbox",
            segments: [{ label: "Ready", value: 7 }],
          },
          {
            label: "Archive",
            segments: [{ label: "Ready", value: 7 }],
          },
        ]}
      />,
    );
    await flushUpdates();

    const fallbackRows = container.querySelectorAll('[data-slot="chart-table"] tbody tr');
    const segments = [...container.querySelectorAll('[data-slot="stacked-bar-chart-segment"]')];

    expect(fallbackRows).toHaveLength(2);
    expect(fallbackRows[0]?.textContent).toContain("Inbox");
    expect(fallbackRows[0]?.textContent).toContain("Ready");
    expect(fallbackRows[0]?.textContent).toContain("7");
    expect(segments.map((segment) => segment.getAttribute("aria-label"))).toEqual([
      "Inbox: Ready: 7",
      "Archive: Ready: 7",
    ]);
  });

  it("should aligns chart tooltips to the pointer inside the hovered trigger", async () => {
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

    expect(normalizeStyle(item.getAttribute("style"))).toContain(
      "--ak-chart-tooltip-anchor-x:50px",
    );
    expect(normalizeStyle(item.getAttribute("style"))).toContain(
      "--ak-chart-tooltip-anchor-y:20px",
    );
  });
});

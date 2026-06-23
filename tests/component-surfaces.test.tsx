import { afterEach, describe, expect, it } from "vite-plus/test";

import { cleanupApp, createIsland } from "@askrjs/askr/boot";

import {
  AreaChart,
  ChartEmptyState,
  ChartLegend,
  ChartPanel,
  ChartShell,
  LineChart,
  RadialGauge,
  Sparkline,
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

describe("component surfaces", () => {
  let container: HTMLElement | undefined;

  afterEach(() => {
    unmount(container);
    container = undefined;
  });

  it("should renders chart support primitives with semantic slots and provided content", async () => {
    container = mount(
      <ChartShell title="Operations" description="Weekly summary">
        <ChartPanel title="Revenue panel" description="Primary panel">
          <ChartLegend
            title="Legend"
            items={[
              { label: "North", value: "42", color: "#2563eb" },
              { label: "South", value: "21", color: "#0f766e" },
            ]}
          />
          <ChartEmptyState title="No alerts" description="Everything is healthy">
            <button type="button">Review systems</button>
          </ChartEmptyState>
        </ChartPanel>
      </ChartShell>,
    );
    await flushUpdates();

    expect(container.querySelector('[data-slot="chart-shell-title"]')?.textContent).toBe(
      "Operations",
    );
    expect(container.querySelector('[data-slot="chart-shell-description"]')?.textContent).toBe(
      "Weekly summary",
    );
    expect(container.querySelector('[data-slot="chart-panel-title"]')?.textContent).toBe(
      "Revenue panel",
    );
    expect(container.querySelectorAll('[data-slot="chart-legend-item"]')).toHaveLength(2);
    expect(container.querySelector('[data-slot="chart-legend-value"]')?.textContent).toBe("42");
    expect(container.querySelector('[data-slot="chart-empty-state-title"]')?.textContent).toBe(
      "No alerts",
    );
    expect(
      container.querySelector('[data-slot="chart-empty-state-content"] button')?.textContent,
    ).toBe("Review systems");
  });

  it("should preserves support primitive root slots when passthrough props include data-slot", async () => {
    container = mount(
      <ChartShell data-slot="external-shell" title="Operations">
        <ChartPanel data-slot="external-panel" title="Revenue panel">
          <ChartLegend
            data-slot="external-legend"
            items={[{ label: "North", value: "42", color: "#2563eb" }]}
          />
          <ChartEmptyState data-slot="external-empty" title="No alerts" />
        </ChartPanel>
      </ChartShell>,
    );
    await flushUpdates();

    expect(container.querySelector(".ak-chart-shell")?.getAttribute("data-slot")).toBe(
      "chart-shell",
    );
    expect(container.querySelector(".ak-chart-panel")?.getAttribute("data-slot")).toBe(
      "chart-panel",
    );
    expect(container.querySelector(".ak-chart-legend")?.getAttribute("data-slot")).toBe(
      "chart-legend",
    );
    expect(container.querySelector(".ak-chart-empty-state")?.getAttribute("data-slot")).toBe(
      "chart-empty-state",
    );
  });

  it("should preserves falsy empty state children", async () => {
    container = mount(<ChartEmptyState title="No alerts">{0}</ChartEmptyState>);
    await flushUpdates();

    const content = container.querySelector('[data-slot="chart-empty-state-content"]');

    expect(content).toBeTruthy();
    expect(content?.textContent).toBe("0");
  });

  it("should renders legend items with duplicate labels", async () => {
    container = mount(
      <ChartLegend
        items={[
          { label: "Queue", value: "Ready", color: "#2563eb" },
          { label: "Queue", value: "Delayed", color: "#dc2626" },
        ]}
      />,
    );
    await flushUpdates();

    const items = [...container.querySelectorAll('[data-slot="chart-legend-item"]')];

    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("Ready");
    expect(items[1]?.textContent).toContain("Delayed");
  });

  it("should preserves explicit empty legend values", async () => {
    container = mount(<ChartLegend items={[{ label: "No assigned owner", value: "" }]} />);
    await flushUpdates();

    const value = container.querySelector('[data-slot="chart-legend-value"]');

    expect(value).toBeTruthy();
    expect(value?.textContent).toBe("");
  });

  it("should renders trend and compact charts with their specialized slots and values", async () => {
    container = mount(
      <div>
        <AreaChart
          label="Orders"
          animate
          data={[
            { label: "Mon", value: 12 },
            { label: "Tue", value: 18 },
          ]}
        />
        <LineChart
          label="Signups"
          animate
          data={[
            { label: "Mon", value: 8 },
            { label: "Tue", value: 14 },
          ]}
        />
        <RadialGauge label="Fill rate" animate value={68} max={100} description="Quarter target" />
        <Sparkline
          label="Trend"
          animate
          variant="line"
          data={[
            { label: "Mon", value: 4 },
            { label: "Tue", value: 9 },
            { label: "Wed", value: 7 },
          ]}
        />
      </div>,
    );
    await flushUpdates();

    expect(container.querySelector('[data-slot="area-chart-surface"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="line-chart-stroke"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="radial-gauge-value"]')?.textContent).toBe("68");
    expect(container.querySelector('[data-slot="radial-gauge-description"]')?.textContent).toBe(
      "Quarter target",
    );
    expect(
      normalizeStyle(container.querySelector('[data-slot="radial-gauge"]')?.getAttribute("style")),
    ).toContain("--ak-chart-gauge-angle:244.8deg");
    expect(container.querySelector('[data-slot="sparkline-stroke"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="sparkline-stem"]')).toBeNull();
    expect(container.querySelectorAll('[data-slot="sparkline-item"]')).toHaveLength(3);
  });
});

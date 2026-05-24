import { BarChart } from "../../src/components/bar-chart";
import { ChartLegend } from "../../src/components/chart-legend";
import { ChartPanel } from "../../src/components/chart-panel";
import { ChartShell } from "../../src/components/chart-shell";
import { DonutChart } from "../../src/components/donut-chart";
import { FlameGraph } from "../../src/components/flame-graph";
import type { FlameGraphDatum } from "../../src/components/flame-graph";
import { Heatmap } from "../../src/components/heatmap";
import { ProgressMeter } from "../../src/components/progress-meter";
import { StackedBarChart } from "../../src/components/stacked-bar-chart";
import { Timeline } from "../../src/components/timeline";
import {
  createHeatmapLegendItems,
  createValueChartLegendItems,
  type HeatmapDatumInput,
  type ValueChartDatumInput,
} from "../../src/core";

const SERIES_COLORS = ["#0f766e", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#059669"] as const;

const TIMELINE_STATUSES = ["success", "info", "warning", "default"] as const;

export function buildValueData(count = 24): ValueChartDatumInput[] {
  return Array.from({ length: count }, (_, index) => ({
    label: `Point ${index + 1}`,
    value: ((index * 17) % 91) + 9,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    description: index % 3 === 0 ? `Detail for point ${index + 1}` : undefined,
  }));
}

export function buildHeatmapData(columns = 8, rows = 6): HeatmapDatumInput[] {
  return Array.from({ length: columns * rows }, (_, index) => {
    const columnIndex = index % columns;
    const rowIndex = Math.floor(index / columns);

    return {
      x: `Day ${columnIndex + 1}`,
      y: `Week ${rowIndex + 1}`,
      value: ((rowIndex + 2) * (columnIndex + 3) * 7) % 100,
      color: SERIES_COLORS[(rowIndex + columnIndex) % SERIES_COLORS.length],
      description: index % 5 === 0 ? `Cell ${rowIndex + 1}-${columnIndex + 1}` : undefined,
    };
  });
}

export function buildTimelineData(count = 10) {
  return Array.from({ length: count }, (_, index) => ({
    label: `Milestone ${index + 1}`,
    value: `${(index + 1) * 2}d`,
    description: index % 2 === 0 ? `Stage ${index + 1} completed` : undefined,
    status: TIMELINE_STATUSES[index % TIMELINE_STATUSES.length],
    accentColor: index % 3 === 0 ? SERIES_COLORS[index % SERIES_COLORS.length] : undefined,
  }));
}

export function buildStackedBarRows(count = 12, segments = 4) {
  return Array.from({ length: count }, (_, rowIndex) => ({
    label: `Segment row ${rowIndex + 1}`,
    description: rowIndex % 2 === 0 ? `Summary for row ${rowIndex + 1}` : undefined,
    segments: Array.from({ length: segments }, (_, segmentIndex) => ({
      label: `Part ${segmentIndex + 1}`,
      value: ((rowIndex + 1) * (segmentIndex + 3) * 9) % 70,
      color: SERIES_COLORS[(rowIndex + segmentIndex) % SERIES_COLORS.length],
      description:
        segmentIndex === 0 ? `Contribution ${segmentIndex + 1} for row ${rowIndex + 1}` : undefined,
    })),
  }));
}

export function buildFlameGraphData(): FlameGraphDatum[] {
  return [
    {
      label: "renderDashboard",
      value: 180,
      children: [
        {
          label: "normalizeSeries",
          value: 64,
          children: [
            { label: "normalizeBars", value: 28 },
            { label: "normalizeDonut", value: 20 },
            { label: "normalizeHeatmap", value: 16 },
          ],
        },
        {
          label: "composePanels",
          value: 72,
          children: [
            { label: "renderSummary", value: 24 },
            { label: "renderLegend", value: 18 },
            { label: "renderPanels", value: 30 },
          ],
        },
        {
          label: "hydrateInteractions",
          value: 44,
          children: [
            { label: "bindTooltips", value: 20 },
            { label: "wireAnimations", value: 24 },
          ],
        },
      ],
    },
  ];
}

export function buildLegendItems() {
  return [
    ...createValueChartLegendItems(buildValueData(6)),
    ...createHeatmapLegendItems(buildHeatmapData(3, 2), { steps: 3 }),
  ];
}

export function DashboardBench(): JSX.Element {
  const barData = buildValueData(18);
  const donutData = buildValueData(6);
  const heatmapData = buildHeatmapData(6, 4);
  const stackedRows = buildStackedBarRows(6, 4);

  return (
    <ChartShell title="Operations dashboard" description="Tiered chart benchmark surface.">
      <ChartPanel title="Revenue by segment" description="Primary hot path chart rendering.">
        <BarChart label="Revenue by segment" animate data={barData} />
      </ChartPanel>

      <ChartPanel title="Mix and milestones" description="Composition coverage.">
        <DonutChart label="Channel mix" animate data={donutData} />
        <Timeline label="Launch plan" animate data={buildTimelineData(8)} />
      </ChartPanel>

      <ChartPanel title="Capacity map" description="Grid and stacked composition coverage.">
        <Heatmap label="Capacity map" animate data={heatmapData} />
        <StackedBarChart label="Delivery mix" animate data={stackedRows} />
      </ChartPanel>

      <ChartPanel title="Performance summary" description="Status and deep hierarchy coverage.">
        <ProgressMeter
          label="SLO attainment"
          description="Current service level attainment"
          animate
          max={100}
          value={78}
        />
        <FlameGraph label="Request flame graph" animate data={buildFlameGraphData()} />
      </ChartPanel>

      <ChartLegend title="Bench legend" items={buildLegendItems()} />
    </ChartShell>
  );
}

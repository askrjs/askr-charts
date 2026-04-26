import {
  buildHeatmapSummary,
  buildValueChartSummary,
  type ChartValueFormatter,
  type NormalizedHeatmapDatum,
  type NormalizedValueChartDatum,
} from "../../core";

export type ChartStyleValue = string | number | undefined;

export type ChartStyle = Record<string, ChartStyleValue>;

export function mergeChartStyles(base: ChartStyle, incoming?: ChartStyle): ChartStyle {
  return incoming ? { ...base, ...incoming } : base;
}

export function createChartId(prefix: string, value: string): string {
  const slug =
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "chart";

  return `${prefix}-${slug}`;
}

export function getValueChartSummary(
  label: string,
  data: readonly NormalizedValueChartDatum[],
  max: number,
  summary?: string,
): string {
  return summary ?? buildValueChartSummary(label, data, max);
}

export function getHeatmapSummary(
  label: string,
  cells: readonly NormalizedHeatmapDatum[],
  max: number,
  summary?: string,
): string {
  return summary ?? buildHeatmapSummary(label, cells, max);
}

export function resolveValueFormatter(
  formatter?: ChartValueFormatter,
): ChartValueFormatter | undefined {
  return formatter;
}

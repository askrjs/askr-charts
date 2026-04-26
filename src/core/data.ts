export interface ValueChartDatum {
  label: string;
  value: number;
  color?: string;
  description?: string;
}

export interface HeatmapDatum {
  x: string;
  y: string;
  value: number;
  color?: string;
  description?: string;
}

export interface NormalizedValueChartDatum extends ValueChartDatum {
  fraction: number;
  formattedValue: string;
}

export interface NormalizedHeatmapDatum extends HeatmapDatum {
  fraction: number;
  formattedValue: string;
  background: string;
}

export type ChartValueFormatter = (value: number) => string;

const defaultFormatter = new Intl.NumberFormat("en-US");

export function clampChartValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function formatChartValue(value: number, formatter?: ChartValueFormatter): string {
  return formatter ? formatter(value) : defaultFormatter.format(value);
}

export function getValueChartMax(data: readonly ValueChartDatum[], explicitMax?: number): number {
  const normalizedExplicitMax = explicitMax == null ? undefined : clampChartValue(explicitMax);
  if (normalizedExplicitMax && normalizedExplicitMax > 0) {
    return normalizedExplicitMax;
  }

  const detectedMax = data.reduce((max, datum) => {
    const nextValue = clampChartValue(datum.value);
    return nextValue > max ? nextValue : max;
  }, 0);

  return detectedMax > 0 ? detectedMax : 1;
}

export function getValueChartTotal(data: readonly ValueChartDatum[]): number {
  const total = data.reduce((sum, datum) => sum + clampChartValue(datum.value), 0);
  return total > 0 ? total : 0;
}

export function toChartFraction(value: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.min(1, clampChartValue(value) / max);
}

export function normalizeValueChartData(
  data: readonly ValueChartDatum[],
  options: {
    max?: number;
    valueFormatter?: ChartValueFormatter;
  } = {},
): { data: NormalizedValueChartDatum[]; max: number } {
  const max = getValueChartMax(data, options.max);
  return {
    max,
    data: data.map((datum) => {
      const value = clampChartValue(datum.value);
      return {
        ...datum,
        value,
        fraction: toChartFraction(value, max),
        formattedValue: formatChartValue(value, options.valueFormatter),
      };
    }),
  };
}

export function buildValueChartSummary(
  label: string,
  data: readonly NormalizedValueChartDatum[],
  max: number,
): string {
  if (data.length === 0) {
    return `${label}. No data available.`;
  }

  const peak = data.reduce((best, datum) => (datum.value > best.value ? datum : best), data[0]!);
  return `${label}. ${data.length} values. Highest value is ${peak.formattedValue} for ${peak.label}. Scale max is ${formatChartValue(max)}.`;
}

export function buildDonutStops(data: readonly NormalizedValueChartDatum[]): string {
  const total = data.reduce((sum, datum) => sum + datum.value, 0);
  if (total <= 0) {
    return "var(--ak-chart-color-muted) 0deg 360deg";
  }

  let cursor = 0;
  const stops: string[] = [];

  for (const [index, datum] of data.entries()) {
    const slice = (datum.value / total) * 360;
    const start = cursor;
    const end = index === data.length - 1 ? 360 : cursor + slice;
    const color = datum.color ?? `var(--ak-chart-series-${(index % 6) + 1})`;
    stops.push(`${color} ${start}deg ${end}deg`);
    cursor = end;
  }

  return stops.join(", ");
}

export function uniqueLabels(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }

  return ordered;
}

export function normalizeHeatmapData(
  data: readonly HeatmapDatum[],
  options: {
    max?: number;
    valueFormatter?: ChartValueFormatter;
  } = {},
): {
  cells: NormalizedHeatmapDatum[];
  columns: string[];
  rows: string[];
  max: number;
} {
  const max = getValueChartMax(
    data.map((datum) => ({ label: `${datum.x}:${datum.y}`, value: datum.value })),
    options.max,
  );
  const columns = uniqueLabels(data.map((datum) => datum.x));
  const rows = uniqueLabels(data.map((datum) => datum.y));

  return {
    columns,
    rows,
    max,
    cells: data.map((datum) => {
      const value = clampChartValue(datum.value);
      const fraction = toChartFraction(value, max);
      const emphasis = Math.max(14, Math.round(fraction * 100));
      const colorSource = datum.color ?? "var(--ak-chart-color-primary)";
      return {
        ...datum,
        value,
        fraction,
        formattedValue: formatChartValue(value, options.valueFormatter),
        background: `color-mix(in srgb, ${colorSource} ${emphasis}%, var(--ak-chart-color-muted))`,
      };
    }),
  };
}

export function buildHeatmapSummary(
  label: string,
  cells: readonly NormalizedHeatmapDatum[],
  max: number,
): string {
  if (cells.length === 0) {
    return `${label}. No heatmap cells available.`;
  }

  const peak = cells.reduce((best, cell) => (cell.value > best.value ? cell : best), cells[0]!);
  return `${label}. ${cells.length} cells. Peak value is ${peak.formattedValue} at ${peak.y}, ${peak.x}. Scale max is ${formatChartValue(max)}.`;
}

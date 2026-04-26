export interface ValueChartDatum {
  label: string;
  value: number;
  color?: string;
  description?: string;
}

export type ValueChartDatumInput =
  | ValueChartDatum
  | readonly [
      label: string,
      value: number | null | undefined,
      color?: string,
      description?: string,
    ];

export interface HeatmapDatum {
  x: string;
  y: string;
  value: number;
  color?: string;
  description?: string;
}

export type HeatmapDatumInput =
  | HeatmapDatum
  | readonly [
      x: string,
      y: string,
      value: number | null | undefined,
      color?: string,
      description?: string,
    ];

export interface NormalizedValueChartDatum extends ValueChartDatum {
  fraction: number;
  formattedValue: string;
}

export interface NormalizedHeatmapDatum extends HeatmapDatum {
  fraction: number;
  formattedValue: string;
  background: string;
}

export interface ChartLegendDatum {
  label: string;
  value?: string;
  color?: string;
}

export type ChartValueFormatter = (value: number) => string;

const defaultFormatter = new Intl.NumberFormat("en-US");

function isValueChartDatumTuple(
  input: ValueChartDatumInput,
): input is readonly [
  label: string,
  value: number | null | undefined,
  color?: string,
  description?: string,
] {
  return Array.isArray(input);
}

function isHeatmapDatumTuple(
  input: HeatmapDatumInput,
): input is readonly [
  x: string,
  y: string,
  value: number | null | undefined,
  color?: string,
  description?: string,
] {
  return Array.isArray(input);
}

function toValueChartDatum(input: ValueChartDatumInput): ValueChartDatum {
  if (isValueChartDatumTuple(input)) {
    const [label, value, color, description] = input;
    return {
      label,
      value: clampChartValue(value),
      color,
      description,
    };
  }

  return {
    label: input.label,
    value: clampChartValue(input.value),
    color: input.color,
    description: input.description,
  };
}

function toHeatmapDatum(input: HeatmapDatumInput): HeatmapDatum {
  if (isHeatmapDatumTuple(input)) {
    const [x, y, value, color, description] = input;
    return {
      x,
      y,
      value: clampChartValue(value),
      color,
      description,
    };
  }

  return {
    x: input.x,
    y: input.y,
    value: clampChartValue(input.value),
    color: input.color,
    description: input.description,
  };
}

export function clampChartValue(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? Number.NaN)) return 0;
  return Math.max(0, value ?? 0);
}

export function formatChartValue(value: number, formatter?: ChartValueFormatter): string {
  return formatter ? formatter(value) : defaultFormatter.format(value);
}

export function getValueChartMin(
  data: readonly ValueChartDatumInput[],
  explicitMin?: number,
): number {
  const normalizedExplicitMin = explicitMin == null ? undefined : clampChartValue(explicitMin);
  if (normalizedExplicitMin != null) {
    return normalizedExplicitMin;
  }

  const normalizedData = data.map(toValueChartDatum);
  if (normalizedData.length === 0) {
    return 0;
  }

  return normalizedData.reduce(
    (min, datum) => (datum.value < min ? datum.value : min),
    normalizedData[0]?.value ?? 0,
  );
}

export function getValueChartMax(
  data: readonly ValueChartDatumInput[],
  explicitMax?: number,
): number {
  const normalizedData = data.map(toValueChartDatum);
  const normalizedExplicitMax = explicitMax == null ? undefined : clampChartValue(explicitMax);
  if (normalizedExplicitMax && normalizedExplicitMax > 0) {
    return normalizedExplicitMax;
  }

  const detectedMax = normalizedData.reduce((max, datum) => {
    const nextValue = datum.value;
    return nextValue > max ? nextValue : max;
  }, 0);

  return detectedMax > 0 ? detectedMax : 1;
}

export function getValueChartTotal(data: readonly ValueChartDatumInput[]): number {
  const total = data.map(toValueChartDatum).reduce((sum, datum) => sum + datum.value, 0);
  return total > 0 ? total : 0;
}

export function toChartFraction(value: number, max: number, min = 0): number {
  if (!Number.isFinite(max) || max <= min) return 0;
  return Math.min(1, Math.max(0, (clampChartValue(value) - min) / (max - min)));
}

export function normalizeValueChartData(
  data: readonly ValueChartDatumInput[],
  options: {
    min?: number;
    max?: number;
    valueFormatter?: ChartValueFormatter;
  } = {},
): { data: NormalizedValueChartDatum[]; max: number; min: number } {
  const normalizedData = data.map(toValueChartDatum);
  const min = options.min == null ? 0 : getValueChartMin(normalizedData, options.min);
  const max = getValueChartMax(normalizedData, options.max);
  return {
    min,
    max,
    data: normalizedData.map((datum) => {
      const value = datum.value;
      return {
        ...datum,
        value,
        fraction: toChartFraction(value, max, min),
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

export function createValueChartLegendItems(
  data: readonly ValueChartDatumInput[],
  options: {
    valueFormatter?: ChartValueFormatter;
  } = {},
): ChartLegendDatum[] {
  const normalized = normalizeValueChartData(data, options);

  return normalized.data.map((datum, index) => ({
    label: datum.label,
    value: datum.formattedValue,
    color: datum.color ?? `var(--ak-chart-series-${(index % 6) + 1})`,
  }));
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
  data: readonly HeatmapDatumInput[],
  options: {
    min?: number;
    max?: number;
    valueFormatter?: ChartValueFormatter;
  } = {},
): {
  cells: NormalizedHeatmapDatum[];
  columns: string[];
  rows: string[];
  min: number;
  max: number;
} {
  const normalizedData = data.map(toHeatmapDatum);
  const min =
    options.min == null
      ? 0
      : getValueChartMin(
          normalizedData.map((datum) => ({ label: `${datum.x}:${datum.y}`, value: datum.value })),
          options.min,
        );
  const max = getValueChartMax(
    normalizedData.map((datum) => ({ label: `${datum.x}:${datum.y}`, value: datum.value })),
    options.max,
  );
  const columns = uniqueLabels(normalizedData.map((datum) => datum.x));
  const rows = uniqueLabels(normalizedData.map((datum) => datum.y));

  return {
    columns,
    rows,
    min,
    max,
    cells: normalizedData.map((datum) => {
      const value = datum.value;
      const fraction = toChartFraction(value, max, min);
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

export function createHeatmapLegendItems(
  data: readonly HeatmapDatumInput[],
  options: {
    min?: number;
    max?: number;
    steps?: number;
    valueFormatter?: ChartValueFormatter;
  } = {},
): ChartLegendDatum[] {
  const normalized = normalizeHeatmapData(data, options);
  const stepCount = Math.max(1, Math.min(6, Math.floor(options.steps ?? 4)));
  const items: ChartLegendDatum[] = [];

  for (let index = 0; index < stepCount; index += 1) {
    const start = normalized.min + ((normalized.max - normalized.min) / stepCount) * index;
    const end = normalized.min + ((normalized.max - normalized.min) / stepCount) * (index + 1);
    const emphasis = Math.max(14, Math.round(((index + 1) / stepCount) * 100));
    items.push({
      label: `${formatChartValue(start, options.valueFormatter)}-${formatChartValue(end, options.valueFormatter)}`,
      color: `color-mix(in srgb, var(--ak-chart-color-primary) ${emphasis}%, var(--ak-chart-color-muted))`,
    });
  }

  return items;
}

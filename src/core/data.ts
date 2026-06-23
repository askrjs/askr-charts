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

export function clampChartValue(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? Number.NaN)) return 0;
  return Math.max(0, value ?? 0);
}

export function formatChartValue(value: number, formatter?: ChartValueFormatter): string {
  return formatter ? formatter(value) : defaultFormatter.format(value);
}

function calculateChartFraction(value: number, max: number, min = 0): number {
  if (!Number.isFinite(max) || max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function resolveChartScaleMax(
  detectedMax: number,
  explicitMax: number | undefined,
  min: number,
): number {
  const max =
    explicitMax != null && explicitMax > 0 ? explicitMax : detectedMax > 0 ? detectedMax : 1;

  return Math.max(max, min);
}

export function getValueChartMin(
  data: readonly ValueChartDatumInput[],
  explicitMin?: number,
): number {
  const normalizedExplicitMin = explicitMin == null ? undefined : clampChartValue(explicitMin);
  if (normalizedExplicitMin != null) {
    return normalizedExplicitMin;
  }

  let min = Number.POSITIVE_INFINITY;

  for (const datum of data) {
    const value = clampChartValue(isValueChartDatumTuple(datum) ? datum[1] : datum.value);
    if (value < min) {
      min = value;
    }
  }

  return Number.isFinite(min) ? min : 0;
}

export function getValueChartMax(
  data: readonly ValueChartDatumInput[],
  explicitMax?: number,
): number {
  const normalizedExplicitMax = explicitMax == null ? undefined : clampChartValue(explicitMax);
  if (normalizedExplicitMax && normalizedExplicitMax > 0) {
    return normalizedExplicitMax;
  }

  let detectedMax = 0;

  for (const datum of data) {
    const value = clampChartValue(isValueChartDatumTuple(datum) ? datum[1] : datum.value);
    if (value > detectedMax) {
      detectedMax = value;
    }
  }

  return detectedMax > 0 ? detectedMax : 1;
}

export function getValueChartTotal(data: readonly ValueChartDatumInput[]): number {
  let total = 0;

  for (const datum of data) {
    total += clampChartValue(isValueChartDatumTuple(datum) ? datum[1] : datum.value);
  }

  return total > 0 ? total : 0;
}

export function toChartFraction(value: number, max: number, min = 0): number {
  return calculateChartFraction(clampChartValue(value), max, min);
}

export function normalizeValueChartData(
  data: readonly ValueChartDatumInput[],
  options: {
    min?: number;
    max?: number;
    valueFormatter?: ChartValueFormatter;
  } = {},
): { data: NormalizedValueChartDatum[]; max: number; min: number } {
  const normalizedData: NormalizedValueChartDatum[] = [];
  normalizedData.length = data.length;
  const formatter = options.valueFormatter;
  const min = options.min == null ? 0 : clampChartValue(options.min);
  const normalizedExplicitMax = options.max == null ? undefined : clampChartValue(options.max);
  let detectedMax = 0;

  for (let index = 0; index < data.length; index += 1) {
    const input = data[index]!;
    let label: string;
    let value: number;
    let color: string | undefined;
    let description: string | undefined;

    if (isValueChartDatumTuple(input)) {
      label = input[0];
      value = clampChartValue(input[1]);
      color = input[2];
      description = input[3];
    } else {
      label = input.label;
      value = clampChartValue(input.value);
      color = input.color;
      description = input.description;
    }

    if (value > detectedMax) {
      detectedMax = value;
    }

    normalizedData[index] = {
      label,
      value,
      color,
      description,
      fraction: 0,
      formattedValue: "",
    };
  }

  const max = resolveChartScaleMax(detectedMax, normalizedExplicitMax, min);

  for (let index = 0; index < normalizedData.length; index += 1) {
    const datum = normalizedData[index]!;
    datum.fraction = calculateChartFraction(datum.value, max, min);
    datum.formattedValue = formatChartValue(datum.value, formatter);
  }

  return {
    min,
    max,
    data: normalizedData,
  };
}

export function buildValueChartSummary(
  label: string,
  data: readonly NormalizedValueChartDatum[],
  max: number,
  valueFormatter?: ChartValueFormatter,
): string {
  if (data.length === 0) {
    return `${label}. No data available.`;
  }

  let peak = data[0]!;

  for (let index = 1; index < data.length; index += 1) {
    const datum = data[index]!;
    if (datum.value > peak.value) {
      peak = datum;
    }
  }

  return `${label}. ${data.length} values. Highest value is ${peak.formattedValue} for ${peak.label}. Scale max is ${formatChartValue(max, valueFormatter)}.`;
}

export function getChartSeriesColor(index: number, color?: string): string {
  if (color) {
    return color;
  }

  const normalizedIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  return `var(--ak-chart-series-${(normalizedIndex % 10) + 1})`;
}

export type ChartStatusTone = "default" | "success" | "warning" | "danger" | "info";

export function getChartStatusColor(
  tone: ChartStatusTone | undefined,
  color?: string,
): string | undefined {
  if (color) {
    return color;
  }

  switch (tone) {
    case "success":
      return "var(--ak-chart-color-success)";
    case "warning":
      return "var(--ak-chart-color-warning)";
    case "danger":
      return "var(--ak-chart-color-danger)";
    case "info":
      return "var(--ak-chart-color-info)";
    default:
      return undefined;
  }
}

export function buildDonutStops(data: readonly NormalizedValueChartDatum[]): string {
  let total = 0;

  for (let index = 0; index < data.length; index += 1) {
    total += data[index]!.value;
  }

  if (total <= 0) {
    return "var(--ak-chart-color-muted) 0deg 360deg";
  }

  const GAP_DEG = 2;
  let cursor = 0;
  const stops: string[] = [];
  const lastIndex = data.length - 1;

  for (const [index, datum] of data.entries()) {
    const slice = (datum.value / total) * 360;
    const start = cursor;
    const end = index === lastIndex ? 360 : cursor + slice;
    const gap = index === lastIndex ? 0 : Math.min(GAP_DEG, Math.max(0, end - start));
    const segmentEnd = Math.max(start, end - gap);
    const color = getChartSeriesColor(index, datum.color);
    if (segmentEnd > start) {
      stops.push(`${color} ${start}deg ${segmentEnd}deg`);
    }
    if (gap > 0) {
      stops.push(`var(--ak-chart-color-muted) ${segmentEnd}deg ${end}deg`);
    }
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
  const items: ChartLegendDatum[] = [];
  items.length = data.length;
  const formatter = options.valueFormatter;

  for (let index = 0; index < data.length; index += 1) {
    const input = data[index]!;
    let label: string;
    let value: number;
    let color: string | undefined;

    if (isValueChartDatumTuple(input)) {
      label = input[0];
      value = clampChartValue(input[1]);
      color = input[2];
    } else {
      label = input.label;
      value = clampChartValue(input.value);
      color = input.color;
    }

    items[index] = {
      label,
      value: formatChartValue(value, formatter),
      color: getChartSeriesColor(index, color),
    };
  }

  return items;
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
  const cells: NormalizedHeatmapDatum[] = [];
  cells.length = data.length;
  const formatter = options.valueFormatter;
  const min = options.min == null ? 0 : clampChartValue(options.min);
  const normalizedExplicitMax = options.max == null ? undefined : clampChartValue(options.max);
  const columns: string[] = [];
  const rows: string[] = [];
  const seenColumns = new Set<string>();
  const seenRows = new Set<string>();
  let detectedMax = 0;

  for (let index = 0; index < data.length; index += 1) {
    const input = data[index]!;
    let x: string;
    let y: string;
    let value: number;
    let color: string | undefined;
    let description: string | undefined;

    if (isHeatmapDatumTuple(input)) {
      x = input[0];
      y = input[1];
      value = clampChartValue(input[2]);
      color = input[3];
      description = input[4];
    } else {
      x = input.x;
      y = input.y;
      value = clampChartValue(input.value);
      color = input.color;
      description = input.description;
    }

    if (!seenColumns.has(x)) {
      seenColumns.add(x);
      columns.push(x);
    }

    if (!seenRows.has(y)) {
      seenRows.add(y);
      rows.push(y);
    }

    if (value > detectedMax) {
      detectedMax = value;
    }

    cells[index] = {
      x,
      y,
      value,
      color,
      description,
      fraction: 0,
      formattedValue: "",
      background: "",
    };
  }

  const max = resolveChartScaleMax(detectedMax, normalizedExplicitMax, min);

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index]!;
    const fraction = calculateChartFraction(cell.value, max, min);
    const emphasis = Math.max(14, Math.round(fraction * 100));
    const colorSource = cell.color ?? "var(--ak-chart-color-primary)";

    cell.fraction = fraction;
    cell.formattedValue = formatChartValue(cell.value, formatter);
    cell.background = `color-mix(in srgb, ${colorSource} ${emphasis}%, var(--ak-chart-color-muted))`;
  }

  return {
    columns,
    rows,
    min,
    max,
    cells,
  };
}

export function buildHeatmapSummary(
  label: string,
  cells: readonly NormalizedHeatmapDatum[],
  max: number,
  valueFormatter?: ChartValueFormatter,
): string {
  if (cells.length === 0) {
    return `${label}. No heatmap cells available.`;
  }

  let peak = cells[0]!;

  for (let index = 1; index < cells.length; index += 1) {
    const cell = cells[index]!;
    if (cell.value > peak.value) {
      peak = cell;
    }
  }

  return `${label}. ${cells.length} cells. Peak value is ${peak.formattedValue} at ${peak.y}, ${peak.x}. Scale max is ${formatChartValue(max, valueFormatter)}.`;
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
  const min = options.min == null ? 0 : clampChartValue(options.min);
  const normalizedExplicitMax = options.max == null ? undefined : clampChartValue(options.max);
  let detectedMax = 0;

  if (!(normalizedExplicitMax && normalizedExplicitMax > 0)) {
    for (let index = 0; index < data.length; index += 1) {
      const input = data[index]!;
      const value = clampChartValue(isHeatmapDatumTuple(input) ? input[2] : input.value);
      if (value > detectedMax) {
        detectedMax = value;
      }
    }
  }

  const max = resolveChartScaleMax(detectedMax, normalizedExplicitMax, min);
  const requestedSteps = options.steps ?? 4;
  const stepCount = Number.isFinite(requestedSteps)
    ? Math.max(1, Math.min(6, Math.floor(requestedSteps)))
    : 4;
  const items: ChartLegendDatum[] = [];
  const stepSize = (max - min) / stepCount;

  for (let index = 0; index < stepCount; index += 1) {
    const start = min + stepSize * index;
    const end = min + stepSize * (index + 1);
    const emphasis = Math.max(14, Math.round(((index + 1) / stepCount) * 100));
    items.push({
      label: `${formatChartValue(start, options.valueFormatter)}-${formatChartValue(end, options.valueFormatter)}`,
      color: `color-mix(in srgb, var(--ak-chart-color-primary) ${emphasis}%, var(--ak-chart-color-muted))`,
    });
  }

  return items;
}

import { isChannelExpression } from "../expressions";
import type { PlotKey, PrimitiveKind } from "../model";
import { isFiniteNumber, validScaleValue } from "../transforms";
import type { ResolvedScale, ScaleInput } from "../scales";
import type { HitRegion, SceneMark, SceneMarkBase, ScenePoint } from "../scene-model";

export type MarkKind = Extract<
  PrimitiveKind,
  "Bar" | "Line" | "Area" | "Point" | "Arc" | "Cell" | "Rect" | "Rule" | "Text"
>;

export interface PreparedDatum<Row> {
  readonly row: Row;
  readonly sourceIndex: number;
  readonly sourceKeys: readonly PlotKey[];
  readonly key: PlotKey;
  readonly x?: unknown;
  readonly x2?: unknown;
  readonly y?: unknown;
  readonly y2?: unknown;
  readonly value?: unknown;
  readonly radius?: unknown;
  readonly fillValue?: unknown;
  readonly strokeValue?: unknown;
  readonly titleValue?: unknown;
  readonly textValue?: unknown;
  readonly series: string | null;
  readonly defined?: boolean;
  readonly stack0?: number;
  readonly stack1?: number;
  readonly bin0?: number | Date;
  readonly bin1?: number | Date;
  readonly values: Readonly<Record<string, unknown>>;
  visible?: boolean;
}

export interface PreparedMark<Row> {
  readonly kind: MarkKind;
  readonly props: Readonly<Record<string, unknown>>;
  readonly data: readonly PreparedDatum<Row>[];
  readonly ordinal: number;
  readonly directSourceIdentity: boolean;
}

export interface ScaleUse {
  readonly name: string;
  readonly channel: "x" | "y" | "color";
  readonly values: unknown[];
  band: boolean;
  includeZero: boolean;
}

export interface MappedAreaDatum<Row> {
  readonly point: ScenePoint;
  readonly baseline: ScenePoint;
  readonly datum: PreparedDatum<Row>;
}

export const SERIES_COLORS = Object.freeze(
  Array.from({ length: 10 }, (_, index) => `var(--ak-chart-series-${index + 1})`),
);

export const SERIES_LINE_DASHES: readonly (readonly number[])[] = Object.freeze([
  Object.freeze([]),
  Object.freeze([6, 3]),
  Object.freeze([2, 3]),
  Object.freeze([8, 3, 2, 3]),
  Object.freeze([10, 3]),
]);

export const SERIES_POINT_SHAPES = Object.freeze(["circle", "square", "diamond"] as const);

export const MARK_KINDS = new Set<PrimitiveKind>([
  "Bar",
  "Line",
  "Area",
  "Point",
  "Arc",
  "Cell",
  "Rect",
  "Rule",
  "Text",
]);

export function channelSeries(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    return `string:${encodeSeriesString(value)}`;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? `date:${value.getTime()}` : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? `number:${Object.is(value, -0) ? "-0" : String(value)}` : null;
  }
  if (typeof value === "boolean") return `boolean:${String(value)}`;
  return null;
}

export function encodeSeriesString(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += encodeURIComponent(value.slice(index, index + 2));
        index += 1;
        continue;
      }
    }
    if (code >= 0xd800 && code <= 0xdfff) {
      result += `%u${code.toString(16).padStart(4, "0")}`;
    } else {
      result += encodeURIComponent(value[index]!);
    }
  }
  return result;
}

export function isConstant(value: unknown): boolean {
  return isChannelExpression(value) && value.kind === "constant";
}

export function pointSourceKeys(points: readonly ScenePoint[]): readonly PlotKey[] {
  return Object.freeze([...new Set(points.map(({ key }) => key))]);
}

export function resolveDash(value: unknown, mark: "Line" | "Rule"): readonly number[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new TypeError(`${mark} dash must be an array of numbers.`);
  }
  if (!value.every((entry) => isFiniteNumber(entry) && entry >= 0)) {
    throw new RangeError(`${mark} dash entries must be finite non-negative numbers.`);
  }
  return Object.freeze([...value] as number[]);
}

export function markBase<Row>(
  mark: PreparedMark<Row>,
  datum: PreparedDatum<Row>,
  kind: SceneMark<Row>["kind"],
  index: number,
  scales: Readonly<Record<string, ResolvedScale>>,
): SceneMarkBase<Row> {
  const colorScale = String(mark.props.colorScale ?? "color");
  const defaultColor = SERIES_COLORS[mark.ordinal % SERIES_COLORS.length]!;
  const fill = paint(
    mark.props.fill ?? mark.props.category,
    datum.fillValue ?? (kind === "cell" ? datum.value : undefined),
    colorScale,
    defaultColor,
    scales,
  );
  const stroke = paint(
    mark.props.stroke,
    datum.strokeValue,
    colorScale,
    kind === "bar" || kind === "cell" || kind === "arc" || kind === "rect" ? "none" : defaultColor,
    scales,
  );
  return {
    id: `${kind}-${mark.ordinal}-${String(datum.key)}-${index}`,
    key: datum.key,
    sourceKeys: datum.sourceKeys,
    sourceIndex: datum.sourceIndex,
    row: datum.row,
    fill: kind === "line" || kind === "rule" ? "none" : fill,
    stroke,
    opacity: Math.max(0, Math.min(1, finiteOr(mark.props.opacity, 1))),
    title: titleFor(datum),
    series: datum.series,
    channels: datum.values,
  };
}

export function paint(
  input: unknown,
  value: unknown,
  scaleName: string,
  fallback: string,
  scales: Readonly<Record<string, ResolvedScale>>,
): string {
  if (isConstant(input))
    return String((input as { options: Record<string, unknown> }).options.value);
  if (value != null) {
    const mappedColor = validPaintScaleValue(value)
      ? scales[scaleName]?.map(value as ScaleInput)
      : undefined;
    if (typeof mappedColor === "string") return mappedColor;
    const index = stableHash(String(value)) % SERIES_COLORS.length;
    return SERIES_COLORS[index]!;
  }
  return fallback;
}

export function rectHit<Row>(
  mark: Extract<SceneMark<Row>, { kind: "bar" | "cell" | "rect" }>,
  datum: PreparedDatum<Row>,
  order: number,
): HitRegion<Row> {
  return Object.freeze({
    id: `${mark.id}-hit`,
    shape: Object.freeze({
      kind: "rect",
      x: mark.x,
      y: mark.y,
      width: mark.width,
      height: mark.height,
    }),
    row: datum.row,
    sourceIndex: datum.sourceIndex,
    key: datum.key,
    sourceKeys: datum.sourceKeys,
    markId: mark.id,
    mark: mark.kind,
    title: mark.title,
    channels: datum.values,
    series: datum.series,
    order,
  });
}

export function mapped(scale: ResolvedScale, value: unknown, center = false): number | null {
  if (!validScaleValue(value) && typeof value !== "boolean") return null;
  const result = scale.map(value as ScaleInput);
  return typeof result === "number" && Number.isFinite(result)
    ? result + (center ? (scale.bandwidth ?? 0) / 2 : 0)
    : null;
}

export function groupBySeries<Row>(data: readonly PreparedDatum<Row>[]) {
  const groups = new Map<string, PreparedDatum<Row>[]>();
  for (const datum of data) {
    const key = datum.series ?? "__default__";
    const group = groups.get(key) ?? [];
    group.push(datum);
    groups.set(key, group);
  }
  return groups;
}

export function formatValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "missing";
  return String(value);
}

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function validPaintScaleValue(value: unknown): value is ScaleInput {
  return typeof value === "boolean" || validScaleValue(value);
}

export function intersectsPlot(
  x: number,
  y: number,
  width: number,
  height: number,
  plot: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    x + width < plot.x ||
    x > plot.x + plot.width ||
    y + height < plot.y ||
    y > plot.y + plot.height
  );
}

export function pointInPlot(
  x: number,
  y: number,
  plot: { x: number; y: number; width: number; height: number },
): boolean {
  return x >= plot.x && x <= plot.x + plot.width && y >= plot.y && y <= plot.y + plot.height;
}

export function emptyCompiled<Row>(): {
  marks: SceneMark<Row>[];
  hits: HitRegion<Row>[];
} {
  return { marks: [], hits: [] };
}

export function boundMeterValue(value: unknown, props: Readonly<Record<string, unknown>>): unknown {
  if (!isFiniteNumber(value)) return value;
  const minimum = isFiniteNumber(props.min) ? props.min : Number.NEGATIVE_INFINITY;
  const maximum = isFiniteNumber(props.max) ? props.max : Number.POSITIVE_INFINITY;
  return Math.max(Math.min(minimum, maximum), Math.min(Math.max(minimum, maximum), value));
}

export function finiteOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

export function clampRadius(value: unknown, maximum: number, fallback: number): number {
  const resolved = finiteOr(value, fallback);
  return Math.max(0, Math.min(maximum, resolved <= 1 ? resolved * maximum : resolved));
}

export function toCurve(value: unknown): "linear" | "step" | "monotone" {
  return value === "step" || value === "monotone" ? value : "linear";
}

export function toPointShape(value: unknown): "circle" | "square" | "diamond" {
  return value === "square" || value === "diamond" ? value : "circle";
}

export function toTextAlign(value: unknown): CanvasTextAlign {
  return ["left", "right", "center", "start", "end"].includes(String(value))
    ? (value as CanvasTextAlign)
    : "center";
}

export function toTextBaseline(value: unknown): CanvasTextBaseline {
  return ["top", "hanging", "middle", "alphabetic", "ideographic", "bottom"].includes(String(value))
    ? (value as CanvasTextBaseline)
    : "middle";
}

export function titleFor<Row>(datum: PreparedDatum<Row>): string {
  if (datum.titleValue != null) return String(datum.titleValue);
  return Object.entries(datum.values)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join(", ");
}

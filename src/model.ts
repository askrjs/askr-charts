/** A row identity: any string or number usable as a stable key for a plot row. */
export type PlotKey = string | number;

/** A primitive value a plot channel may resolve to. */
export type PlotScalar = string | number | boolean | Date;
/** A channel value, allowing for missing data. */
export type PlotChannelValue = PlotScalar | null | undefined;
/** A value usable as a scale domain/range endpoint. */
export type ScaleValue = string | number | Date;
/** A scale domain value, including booleans (for ordinal/color scales). */
export type ScaleDomainValue = ScaleValue | boolean;

/** The string-keyed field names of a row type. */
export type RowField<Row> = Extract<keyof Row, string>;

type Present<Value> = Exclude<Value, null | undefined>;

/** The field names of `Row` whose (non-nullable) value type is assignable to `Value`. */
export type FieldOfType<Row, Value> = {
  [Field in RowField<Row>]-?: Present<Row[Field]> extends Value ? Field : never;
}[RowField<Row>];

/** Field names of `Row` holding numbers. */
export type NumericField<Row> = FieldOfType<Row, number>;
/** Field names of `Row` holding `Date` values. */
export type TemporalField<Row> = FieldOfType<Row, Date>;
/** Field names of `Row` holding categorical (string, number, or boolean) values. */
export type CategoricalField<Row> = FieldOfType<Row, string | number | boolean>;
/** Field names of `Row` usable as a scale channel (string, number, or Date). */
export type ScaleField<Row> = FieldOfType<Row, string | number | Date>;

/** A function that reads a channel value from a row and its index. */
export type RowAccessor<Row, Value> = (
  row: Readonly<Row>,
  index: number,
) => Value | null | undefined;

/** Anything usable as a mark channel input: a field name, an accessor, or a channel expression. */
export type ChannelInput<Row, Value> =
  | FieldOfType<Row, Value>
  | RowAccessor<Row, Value>
  | ChannelExpression<Value, FieldOfType<Row, Value>>;

type RowExpressionKind = Exclude<
  ChannelExpressionKind,
  "bin" | "count" | "sum" | "mean" | "stack" | "normalize"
>;

/** A channel input restricted to row-level (non-aggregating) expression kinds. */
export type RowChannelInput<Row, Value> =
  | FieldOfType<Row, Value>
  | RowAccessor<Row, Value>
  | ChannelExpression<Value, FieldOfType<Row, Value>, RowExpressionKind>;

/** A channel input for scales that may be binned, e.g. via {@link bin}. */
export type BinnedScaleChannelInput<Row> =
  | RowChannelInput<Row, string | number | Date>
  | ChannelExpression<number | Date, NumericField<Row> | TemporalField<Row>, "bin">;

/** A numeric channel input that may additionally be an aggregate expression. */
export type AggregatedNumericChannelInput<Row> =
  | RowChannelInput<Row, number>
  | ChannelExpression<number, NumericField<Row>, "count" | "sum" | "mean" | "stack" | "normalize">;

/** A channel input for a positional/categorical scale. */
export type ScaleChannelInput<Row> = ChannelInput<Row, string | number | Date>;
/** A channel input resolving to a number. */
export type NumericChannelInput<Row> = ChannelInput<Row, number>;
/** A channel input resolving to a color-scale-compatible value. */
export type ColorChannelInput<Row> = ChannelInput<Row, string | number | boolean>;
/** A channel input resolving to a displayable text value. */
export type TextChannelInput<Row> = ChannelInput<Row, string | number | Date | boolean>;
/** {@link RowChannelInput} for a positional/categorical scale. */
export type RowScaleChannelInput<Row> = RowChannelInput<Row, string | number | Date>;
/** {@link RowChannelInput} resolving to a number. */
export type RowNumericChannelInput<Row> = RowChannelInput<Row, number>;
/** {@link RowChannelInput} resolving to a color-scale-compatible value. */
export type RowColorChannelInput<Row> = RowChannelInput<Row, string | number | boolean>;
/** {@link RowChannelInput} resolving to a displayable text value. */
export type RowTextChannelInput<Row> = RowChannelInput<Row, string | number | Date | boolean>;

/** Aggregate operations supported by grouping expressions. */
export type AggregateOperation = "count" | "sum" | "mean";
/** Operations supported by moving-window expressions. */
export type WindowOperation = "sum" | "mean" | "min" | "max";

/** The discriminant `kind` values a {@link ChannelExpression} may carry. */
export type ChannelExpressionKind =
  | "constant"
  | "bin"
  | "count"
  | "sum"
  | "mean"
  | "group"
  | "stack"
  | "normalize"
  | "moving-window"
  | "moving-average"
  | "regression";

/**
 * A serialized channel transform produced by helpers such as {@link bin}, {@link sum},
 * or {@link stack}, and consumed by mark channel props (e.g. `x`, `y`).
 */
export interface ChannelExpression<
  Value,
  Field extends string = never,
  Kind extends ChannelExpressionKind = ChannelExpressionKind,
> {
  readonly __askrPlotExpression: true;
  readonly kind: Kind;
  readonly input?: unknown;
  readonly options: Readonly<Record<string, unknown>>;
  readonly __field?: Field;
  readonly __value?: Value;
}

/** The discriminant `kind` values a {@link RowTransform} may carry. */
export type RowTransformKind = "filter" | "sort" | "partition";

/**
 * A serialized row-level transform produced by helpers such as {@link filterRows},
 * {@link sortRows}, or {@link partition}, and applied to a mark's `data` via `transform`.
 */
export interface RowTransform<Row> {
  readonly __askrPlotTransform: true;
  readonly kind: RowTransformKind;
  readonly options: Readonly<Record<string, unknown>>;
  readonly __row?: (row: Row) => Row;
}

/** Options for {@link bin}. */
export interface BinOptions {
  thresholds?: number | readonly number[];
  interval?: number;
  domain?: readonly [number | Date, number | Date];
}

/** Options for {@link stack}. */
export interface StackOptions {
  offset?: "zero" | "diverging" | "expand";
  order?: "none" | "ascending" | "descending" | "inside-out";
}

/** Options for {@link movingWindow} and {@link movingAverage}. */
export interface MovingWindowOptions {
  window: number;
  operation?: WindowOperation;
  partial?: boolean;
}

/** Options for {@link regression}. */
export interface RegressionOptions<Row> {
  x?: RowScaleChannelInput<Row>;
  method?: "linear";
}

/** Options for {@link partition}. */
export interface PartitionOptions<Row> {
  id: RowField<Row> | RowAccessor<Row, PlotKey>;
  parentId?: RowField<Row> | RowAccessor<Row, PlotKey | null | undefined>;
  children?: RowField<Row> | RowAccessor<Row, readonly Row[] | null | undefined>;
  value: RowNumericChannelInput<Row>;
  padding?: number;
}

/** Options for {@link sortRows}. */
export interface SortRowsOptions<Row> {
  by: RowField<Row> | RowAccessor<Row, unknown>;
  direction?: "ascending" | "descending";
}

/** The data a plot consumes: a readonly array of rows, or a function producing one. */
export type PlotData<Row> = readonly Row[] | (() => readonly Row[]);
/** How to derive a row's stable {@link PlotKey}: a field name or an accessor function. */
export type PlotRowKey<Row> = FieldOfType<Row, PlotKey> | RowAccessor<Row, PlotKey>;

/** The scale types supported by `Plot.Scale`. */
export type ScaleType =
  | "band"
  | "point"
  | "linear"
  | "power"
  | "log"
  | "symlog"
  | "time"
  | "utc"
  | "ordinal-color"
  | "continuous-color";

/** A Cartesian axis identifier. */
export type CartesianAxis = "x" | "y";
/** The side of the plot an axis is rendered on. */
export type AxisOrientation = "top" | "right" | "bottom" | "left";

/** The visible domain of a plot's scales, used for `view`/`defaultView`. */
export interface PlotView {
  x?: readonly [ScaleValue, ScaleValue];
  y?: readonly [ScaleValue, ScaleValue];
  scales?: Readonly<Record<string, readonly [ScaleValue, ScaleValue]>>;
}

/** The set of row keys currently selected via `Plot.Select`. */
export interface PlotSelection {
  keys: readonly PlotKey[];
}

/** How a plot interaction was triggered. */
export type PlotInteractionOrigin = "pointer" | "keyboard";

/** The mark instance a pointer/keyboard interaction resolved to. */
export interface PlotInteractionTarget<Row> {
  readonly row: Row;
  readonly key: PlotKey;
  readonly sourceKeys: readonly PlotKey[];
  readonly markKind: "bar" | "line" | "area" | "point" | "arc" | "cell" | "rect" | "rule" | "text";
  readonly markId: string;
  readonly series: string | null;
  readonly channels: Readonly<Record<string, unknown>>;
  readonly origin: PlotInteractionOrigin;
}

/** Keep only the most recent N rows; see {@link FollowLatest}. */
export interface FollowLatestRows {
  rows: number;
}

/** Keep only rows within a trailing time window of a temporal field; see {@link FollowLatest}. */
export interface FollowLatestTime<Row> {
  durationMs: number;
  field: TemporalField<Row> | RowAccessor<Row, Date>;
}

/**
 * `RootProps.followLatest` shorthand: a bare number is treated as a row count
 * (equivalent to `{ rows: n }`).
 */
export type FollowLatest<Row> = number | FollowLatestRows | FollowLatestTime<Row>;

/** ARIA `meter` role semantics applied to the plot's graphic region. */
export interface MeterSemantics {
  role: "meter";
  min: number;
  max: number;
  value: number;
  valueText?: string;
}

/** Options shared by the plot export methods that capture a rendered view. */
export interface PlotExportViewOptions {
  view?: "current" | "full";
  background?: string | null;
}

/** Options for {@link PlotApi.exportPng}. */
export interface PlotPngExportOptions extends PlotExportViewOptions {
  pixelRatio?: number;
  includeOverlays?: boolean;
}

/** Options for {@link PlotApi.exportSvg}. */
export interface PlotSvgExportOptions extends PlotExportViewOptions {
  includeOverlays?: boolean;
}

/** Options for {@link PlotApi.exportData}. */
export interface PlotDataExportOptions {
  view?: "current" | "full";
  rows?: "source" | "transformed";
  scope?: "all" | "visible" | "selected";
  format?: "csv" | "json";
}

/** The imperative API exposed for a rendered plot, delivered via `RootProps.onApiChange`. */
export interface PlotApi<Row> {
  resetView(): void;
  resumeLive(): void;
  exportPng(options?: PlotPngExportOptions): Promise<Blob>;
  exportSvg(options?: PlotSvgExportOptions): string;
  exportData(options?: PlotDataExportOptions): string;
  readonly rows: readonly Row[];
}

/** A valid heading level (`h1`–`h6`) for `RootProps.headingLevel`. */
export type PlotHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Props accepted by a plot factory's `Root` component. */
export interface RootProps<Row> {
  data: PlotData<Row>;
  rowKey: PlotRowKey<Row>;
  label: string;
  children?: unknown;
  title?: string;
  headingLevel?: PlotHeadingLevel;
  description?: string;
  summary?: string | ((context: PlotSummaryContext<Row>) => string);
  empty?: string;
  width?: number;
  height?: number;
  class?: string;
  style?: string | Record<string, string | number | null | undefined | false>;
  id?: string;
  meter?: MeterSemantics;
  view?: PlotView;
  defaultView?: PlotView;
  onViewChange?: (view: PlotView) => void;
  selection?: PlotSelection;
  defaultSelection?: PlotSelection;
  onSelectionChange?: (selection: PlotSelection) => void;
  onActivate?: (row: Row, key: PlotKey, target: PlotInteractionTarget<Row>) => void;
  followLatest?: FollowLatest<Row>;
  onApiChange?: (api: PlotApi<Row> | null) => void;
  locale?: string;
  diagnostics?: boolean;
}

/** Context passed to a `RootProps.summary` function to compute the plot's summary text. */
export interface PlotSummaryContext<Row> {
  readonly rows: readonly Row[];
  readonly sourceRowCount: number;
  readonly transformedRowCount: number;
  readonly omittedRowCount: number;
  readonly visibleRowCount: number;
}

/** Props for `Plot.Scale`. */
export interface ScaleProps {
  name?: string;
  channel?: "x" | "y" | "color";
  type?: ScaleType;
  domain?: readonly ScaleDomainValue[];
  range?: readonly (number | string)[];
  clamp?: boolean;
  nice?: boolean | number;
  reverse?: boolean;
  padding?: number;
  paddingInner?: number;
  paddingOuter?: number;
  exponent?: number;
  base?: number;
  constant?: number;
  unknown?: string;
}

/** Props for `Plot.Axis`. */
export interface AxisProps {
  scale?: string;
  axis?: CartesianAxis;
  orient?: AxisOrientation;
  label?: string;
  tickCount?: number;
  tickFormat?: (value: ScaleValue) => string;
  grid?: boolean;
}

/** Props for `Plot.Grid`. */
export interface GridProps {
  scale?: string;
  axis?: CartesianAxis;
  tickCount?: number;
}

/** Props shared by all mark components. */
export interface MarkBaseProps<Row> {
  data?: PlotData<Row>;
  transform?: RowTransform<Row> | readonly RowTransform<Row>[];
  xScale?: string;
  yScale?: string;
  colorScale?: string;
  fill?: RowColorChannelInput<Row>;
  stroke?: RowColorChannelInput<Row>;
  opacity?: number;
  title?: RowTextChannelInput<Row>;
  key?: PlotRowKey<Row>;
  hidden?: boolean;
}

/** Props shared by marks positioned on Cartesian (x/y) axes. */
export interface CartesianMarkProps<Row> extends MarkBaseProps<Row> {
  x?: unknown;
  x2?: unknown;
  y?: unknown;
  y2?: unknown;
}

/** Props for `Plot.Bar`. */
export interface BarProps<Row> extends CartesianMarkProps<Row> {
  x: BinnedScaleChannelInput<Row>;
  y: AggregatedNumericChannelInput<Row>;
  orientation?: "vertical" | "horizontal";
  stack?: CategoricalField<Row> | RowAccessor<Row, PlotScalar> | boolean;
  normalize?: boolean;
  radius?: number;
  inset?: number;
  min?: number;
  max?: number;
}

/** Props for `Plot.Line`. */
export interface LineProps<Row> extends CartesianMarkProps<Row> {
  x: RowScaleChannelInput<Row>;
  y: RowNumericChannelInput<Row>;
  curve?: "linear" | "step" | "monotone";
  strokeWidth?: number;
  /**
   * Explicit stroke dash pattern. When omitted, a multi-series line mark cycles
   * accessible dash patterns; pass an empty array to keep every series solid.
   */
  dash?: readonly number[];
  defined?: RowAccessor<Row, boolean>;
}

/** Props for `Plot.Area`. */
export interface AreaProps<Row> extends CartesianMarkProps<Row> {
  x: BinnedScaleChannelInput<Row>;
  y: AggregatedNumericChannelInput<Row>;
  y2?: RowNumericChannelInput<Row>;
  baseline?: number;
  curve?: "linear" | "step" | "monotone";
  stack?: CategoricalField<Row> | RowAccessor<Row, PlotScalar> | boolean;
  normalize?: boolean;
}

/** Props for `Plot.Point`. */
export interface PointProps<Row> extends CartesianMarkProps<Row> {
  x: RowScaleChannelInput<Row>;
  y: RowNumericChannelInput<Row>;
  r?: RowNumericChannelInput<Row> | number;
  /**
   * Explicit point shape. When omitted, a multi-series point mark cycles shapes
   * so color is not the only default series encoding.
   */
  shape?: "circle" | "square" | "diamond";
}

/** Props for `Plot.Arc`. */
export interface ArcProps<Row> extends MarkBaseProps<Row> {
  value: RowNumericChannelInput<Row>;
  category?: RowColorChannelInput<Row>;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  padAngle?: number;
  cornerRadius?: number;
  min?: number;
  max?: number;
}

/** Props for `Plot.Cell`. */
export interface CellProps<Row> extends CartesianMarkProps<Row> {
  x: RowScaleChannelInput<Row>;
  y: RowScaleChannelInput<Row>;
  value?: RowNumericChannelInput<Row>;
  inset?: number;
}

/** Props for `Plot.Rect`. */
export interface RectProps<Row> extends CartesianMarkProps<Row> {
  x?: RowScaleChannelInput<Row>;
  x2?: RowScaleChannelInput<Row>;
  y?: RowScaleChannelInput<Row>;
  y2?: RowScaleChannelInput<Row>;
  radius?: number;
}

/** Props for `Plot.Rule`. */
export interface RuleProps<Row> extends CartesianMarkProps<Row> {
  x?: RowScaleChannelInput<Row>;
  x2?: RowScaleChannelInput<Row>;
  y?: RowScaleChannelInput<Row>;
  y2?: RowScaleChannelInput<Row>;
  strokeWidth?: number;
  dash?: readonly number[];
}

/** Props for `Plot.Text`. */
export interface TextProps<Row> extends CartesianMarkProps<Row> {
  x: RowScaleChannelInput<Row>;
  y: RowScaleChannelInput<Row>;
  text: RowTextChannelInput<Row>;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  font?: string;
}

/** Props for `Plot.Legend`. */
export interface LegendProps {
  scale?: string;
  label?: string;
  interactive?: boolean;
  position?: "top" | "right" | "bottom" | "left";
}

/** Props for `Plot.Tooltip`. */
export interface TooltipProps {
  channels?: readonly string[];
  format?: (record: Readonly<Record<string, unknown>>) => string;
  mode?: "auto" | "mark" | "x";
}

/** Props for `Plot.Select`. */
export interface SelectProps {
  mode?: "single" | "toggle";
}

/** Props for `Plot.Crosshair`. */
export interface CrosshairProps {
  axes?: "x" | "y" | "xy";
}

/** Props for `Plot.Zoom`. */
export interface ZoomProps {
  axes?: "x" | "y" | "xy";
  min?: number;
  max?: number;
  wheel?: boolean;
  pinch?: boolean;
  pan?: boolean;
}

/** Props for `Plot.Brush`. */
export interface BrushProps {
  axis?: "x" | "y" | "xy";
  modifier?: "shift" | "none";
}

/** A plot component that renders `Props` to a `JSXElement`. */
export interface PrimitiveComponent<Props> {
  (props: Props): JSXElement;
}

/** The set of components returned by {@link createPlot} for a given row type. */
export interface PlotFactory<Row> {
  readonly Root: PrimitiveComponent<RootProps<Row>>;
  readonly Scale: PrimitiveComponent<ScaleProps>;
  readonly Axis: PrimitiveComponent<AxisProps>;
  readonly Grid: PrimitiveComponent<GridProps>;
  readonly Bar: PrimitiveComponent<BarProps<Row>>;
  readonly Line: PrimitiveComponent<LineProps<Row>>;
  readonly Area: PrimitiveComponent<AreaProps<Row>>;
  readonly Point: PrimitiveComponent<PointProps<Row>>;
  readonly Arc: PrimitiveComponent<ArcProps<Row>>;
  readonly Cell: PrimitiveComponent<CellProps<Row>>;
  readonly Rect: PrimitiveComponent<RectProps<Row>>;
  readonly Rule: PrimitiveComponent<RuleProps<Row>>;
  readonly Text: PrimitiveComponent<TextProps<Row>>;
  readonly Legend: PrimitiveComponent<LegendProps>;
  readonly Tooltip: PrimitiveComponent<TooltipProps>;
  readonly Crosshair: PrimitiveComponent<CrosshairProps>;
  readonly Select: PrimitiveComponent<SelectProps>;
  readonly Zoom: PrimitiveComponent<ZoomProps>;
  readonly Brush: PrimitiveComponent<BrushProps>;
}

/** The keys of {@link PlotFactory} that identify a mark/annotation primitive (excludes `Root`). */
export type PrimitiveKind = Exclude<keyof PlotFactory<unknown>, "Root">;
import type { JSXElement } from "@askrjs/askr/jsx-runtime";

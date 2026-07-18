export type PlotKey = string | number;

export type PlotScalar = string | number | boolean | Date;
export type PlotChannelValue = PlotScalar | null | undefined;
export type ScaleValue = string | number | Date;
export type ScaleDomainValue = ScaleValue | boolean;

export type RowField<Row> = Extract<keyof Row, string>;

type Present<Value> = Exclude<Value, null | undefined>;

export type FieldOfType<Row, Value> = {
  [Field in RowField<Row>]-?: Present<Row[Field]> extends Value ? Field : never;
}[RowField<Row>];

export type NumericField<Row> = FieldOfType<Row, number>;
export type TemporalField<Row> = FieldOfType<Row, Date>;
export type CategoricalField<Row> = FieldOfType<Row, string | number | boolean>;
export type ScaleField<Row> = FieldOfType<Row, string | number | Date>;

export type RowAccessor<Row, Value> = (
  row: Readonly<Row>,
  index: number,
) => Value | null | undefined;

export type ChannelInput<Row, Value> =
  | FieldOfType<Row, Value>
  | RowAccessor<Row, Value>
  | ChannelExpression<Value, FieldOfType<Row, Value>>;

type RowExpressionKind = Exclude<
  ChannelExpressionKind,
  "bin" | "count" | "sum" | "mean" | "stack" | "normalize"
>;

export type RowChannelInput<Row, Value> =
  | FieldOfType<Row, Value>
  | RowAccessor<Row, Value>
  | ChannelExpression<Value, FieldOfType<Row, Value>, RowExpressionKind>;

export type BinnedScaleChannelInput<Row> =
  | RowChannelInput<Row, string | number | Date>
  | ChannelExpression<number | Date, NumericField<Row> | TemporalField<Row>, "bin">;

export type AggregatedNumericChannelInput<Row> =
  | RowChannelInput<Row, number>
  | ChannelExpression<number, NumericField<Row>, "count" | "sum" | "mean" | "stack" | "normalize">;

export type ScaleChannelInput<Row> = ChannelInput<Row, string | number | Date>;
export type NumericChannelInput<Row> = ChannelInput<Row, number>;
export type ColorChannelInput<Row> = ChannelInput<Row, string | number | boolean>;
export type TextChannelInput<Row> = ChannelInput<Row, string | number | Date | boolean>;
export type RowScaleChannelInput<Row> = RowChannelInput<Row, string | number | Date>;
export type RowNumericChannelInput<Row> = RowChannelInput<Row, number>;
export type RowColorChannelInput<Row> = RowChannelInput<Row, string | number | boolean>;
export type RowTextChannelInput<Row> = RowChannelInput<Row, string | number | Date | boolean>;

export type AggregateOperation = "count" | "sum" | "mean";
export type WindowOperation = "sum" | "mean" | "min" | "max";

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

export type RowTransformKind = "filter" | "sort" | "partition";

export interface RowTransform<Row> {
  readonly __askrPlotTransform: true;
  readonly kind: RowTransformKind;
  readonly options: Readonly<Record<string, unknown>>;
  readonly __row?: (row: Row) => Row;
}

export interface BinOptions {
  thresholds?: number | readonly number[];
  interval?: number;
  domain?: readonly [number | Date, number | Date];
}

export interface StackOptions {
  offset?: "zero" | "diverging" | "expand";
  order?: "none" | "ascending" | "descending" | "inside-out";
}

export interface MovingWindowOptions {
  window: number;
  operation?: WindowOperation;
  partial?: boolean;
}

export interface RegressionOptions<Row> {
  x?: RowScaleChannelInput<Row>;
  method?: "linear";
}

export interface PartitionOptions<Row> {
  id: RowField<Row> | RowAccessor<Row, PlotKey>;
  parentId?: RowField<Row> | RowAccessor<Row, PlotKey | null | undefined>;
  children?: RowField<Row> | RowAccessor<Row, readonly Row[] | null | undefined>;
  value: RowNumericChannelInput<Row>;
  padding?: number;
}

export interface SortRowsOptions<Row> {
  by: RowField<Row> | RowAccessor<Row, unknown>;
  direction?: "ascending" | "descending";
}

export type PlotData<Row> = readonly Row[] | (() => readonly Row[]);
export type PlotRowKey<Row> = FieldOfType<Row, PlotKey> | RowAccessor<Row, PlotKey>;

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

export type CartesianAxis = "x" | "y";
export type AxisOrientation = "top" | "right" | "bottom" | "left";

export interface PlotView {
  x?: readonly [ScaleValue, ScaleValue];
  y?: readonly [ScaleValue, ScaleValue];
  scales?: Readonly<Record<string, readonly [ScaleValue, ScaleValue]>>;
}

export interface PlotSelection {
  keys: readonly PlotKey[];
}

export type PlotInteractionOrigin = "pointer" | "keyboard";

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

export interface FollowLatestRows {
  rows: number;
}

export interface FollowLatestTime<Row> {
  durationMs: number;
  field: TemporalField<Row> | RowAccessor<Row, Date>;
}

export type FollowLatest<Row> = number | FollowLatestRows | FollowLatestTime<Row>;

export interface MeterSemantics {
  role: "meter";
  min: number;
  max: number;
  value: number;
  valueText?: string;
}

export interface PlotExportViewOptions {
  view?: "current" | "full";
  background?: string | null;
}

export interface PlotPngExportOptions extends PlotExportViewOptions {
  pixelRatio?: number;
  includeOverlays?: boolean;
}

export interface PlotSvgExportOptions extends PlotExportViewOptions {
  includeOverlays?: boolean;
}

export interface PlotDataExportOptions {
  view?: "current" | "full";
  rows?: "source" | "transformed";
  scope?: "all" | "visible" | "selected";
  format?: "csv" | "json";
}

export interface PlotApi<Row> {
  resetView(): void;
  resumeLive(): void;
  exportPng(options?: PlotPngExportOptions): Promise<Blob>;
  exportSvg(options?: PlotSvgExportOptions): string;
  exportData(options?: PlotDataExportOptions): string;
  readonly rows: readonly Row[];
}

export type PlotHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

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

export interface PlotSummaryContext<Row> {
  readonly rows: readonly Row[];
  readonly sourceRowCount: number;
  readonly transformedRowCount: number;
  readonly omittedRowCount: number;
  readonly visibleRowCount: number;
}

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

export interface AxisProps {
  scale?: string;
  axis?: CartesianAxis;
  orient?: AxisOrientation;
  label?: string;
  tickCount?: number;
  tickFormat?: (value: ScaleValue) => string;
  grid?: boolean;
}

export interface GridProps {
  scale?: string;
  axis?: CartesianAxis;
  tickCount?: number;
}

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

export interface CartesianMarkProps<Row> extends MarkBaseProps<Row> {
  x?: unknown;
  x2?: unknown;
  y?: unknown;
  y2?: unknown;
}

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

export interface LineProps<Row> extends CartesianMarkProps<Row> {
  x: RowScaleChannelInput<Row>;
  y: RowNumericChannelInput<Row>;
  curve?: "linear" | "step" | "monotone";
  strokeWidth?: number;
  defined?: RowAccessor<Row, boolean>;
}

export interface AreaProps<Row> extends CartesianMarkProps<Row> {
  x: BinnedScaleChannelInput<Row>;
  y: AggregatedNumericChannelInput<Row>;
  y2?: RowNumericChannelInput<Row>;
  baseline?: number;
  curve?: "linear" | "step" | "monotone";
  stack?: CategoricalField<Row> | RowAccessor<Row, PlotScalar> | boolean;
  normalize?: boolean;
}

export interface PointProps<Row> extends CartesianMarkProps<Row> {
  x: RowScaleChannelInput<Row>;
  y: RowNumericChannelInput<Row>;
  r?: RowNumericChannelInput<Row> | number;
  shape?: "circle" | "square" | "diamond";
}

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

export interface CellProps<Row> extends CartesianMarkProps<Row> {
  x: RowScaleChannelInput<Row>;
  y: RowScaleChannelInput<Row>;
  value?: RowNumericChannelInput<Row>;
  inset?: number;
}

export interface RectProps<Row> extends CartesianMarkProps<Row> {
  x?: RowScaleChannelInput<Row>;
  x2?: RowScaleChannelInput<Row>;
  y?: RowScaleChannelInput<Row>;
  y2?: RowScaleChannelInput<Row>;
  radius?: number;
}

export interface RuleProps<Row> extends CartesianMarkProps<Row> {
  x?: RowScaleChannelInput<Row>;
  x2?: RowScaleChannelInput<Row>;
  y?: RowScaleChannelInput<Row>;
  y2?: RowScaleChannelInput<Row>;
  strokeWidth?: number;
  dash?: readonly number[];
}

export interface TextProps<Row> extends CartesianMarkProps<Row> {
  x: RowScaleChannelInput<Row>;
  y: RowScaleChannelInput<Row>;
  text: RowTextChannelInput<Row>;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  font?: string;
}

export interface LegendProps {
  scale?: string;
  label?: string;
  interactive?: boolean;
  position?: "top" | "right" | "bottom" | "left";
}

export interface TooltipProps {
  channels?: readonly string[];
  format?: (record: Readonly<Record<string, unknown>>) => string;
  mode?: "auto" | "mark" | "x";
}

export interface SelectProps {
  mode?: "single" | "toggle";
}

export interface CrosshairProps {
  axes?: "x" | "y" | "xy";
}

export interface ZoomProps {
  axes?: "x" | "y" | "xy";
  min?: number;
  max?: number;
  wheel?: boolean;
  pinch?: boolean;
  pan?: boolean;
}

export interface BrushProps {
  axis?: "x" | "y" | "xy";
  modifier?: "shift" | "none";
}

export interface PrimitiveComponent<Props> {
  (props: Props): JSXElement;
}

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

export type PrimitiveKind = Exclude<keyof PlotFactory<unknown>, "Root">;
import type { JSXElement } from "@askrjs/askr/jsx-runtime";

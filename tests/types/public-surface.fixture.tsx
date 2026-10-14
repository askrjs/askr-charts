// Supported consumer annotations and direct absence checks run against source and tarballs.
import {
  appendPlotRows,
  bin,
  constant,
  count,
  createPlot,
  filterRows,
  group,
  mean,
  movingAverage,
  movingWindow,
  normalize,
  partition,
  regression,
  removePlotRows,
  sortRows,
  stack,
  sum,
  trimPlotRows,
  upsertPlotRows,
  type ArcProps,
  type AreaProps,
  type AxisOrientation,
  type AxisProps,
  type BarProps,
  type BinOptions,
  type BrushProps,
  type CartesianAxis,
  type CellProps,
  type CrosshairProps,
  type FollowLatest,
  type FollowLatestRows,
  type FollowLatestTime,
  type GridProps,
  type LegendProps,
  type LineProps,
  type MeterSemantics,
  type MovingWindowOptions,
  type PartitionOptions,
  type PlotApi,
  type PlotData,
  type PlotDataExportOptions,
  type PlotExportViewOptions,
  type PlotFactory,
  type PlotHeadingLevel,
  type PlotInteractionOrigin,
  type PlotInteractionTarget,
  type PlotKey,
  type PlotPngExportOptions,
  type PlotRowKey,
  type PlotSelection,
  type PlotSummaryContext,
  type PlotSvgExportOptions,
  type PlotView,
  type PointProps,
  type RectProps,
  type RegressionOptions,
  type RootProps,
  type RuleProps,
  type ScaleProps,
  type ScaleType,
  type ScaleValue,
  type SelectProps,
  type SortRowsOptions,
  type StackOptions,
  type TextProps,
  type TooltipProps,
  type TrimPlotRowsOptions,
  type WindowOperation,
  type ZoomProps,
} from "@askrjs/charts";

interface Row {
  id: string;
  timestamp: Date;
  value: number;
  series: string;
}

export const retainedFunctions = {
  appendPlotRows,
  bin,
  constant,
  count,
  createPlot,
  filterRows,
  group,
  mean,
  movingAverage,
  movingWindow,
  normalize,
  partition,
  regression,
  removePlotRows,
  sortRows,
  stack,
  sum,
  trimPlotRows,
  upsertPlotRows,
};

export interface RetainedContracts {
  ArcProps: ArcProps<Row>;
  AreaProps: AreaProps<Row>;
  AxisOrientation: AxisOrientation;
  AxisProps: AxisProps;
  BarProps: BarProps<Row>;
  BinOptions: BinOptions;
  BrushProps: BrushProps;
  CartesianAxis: CartesianAxis;
  CellProps: CellProps<Row>;
  CrosshairProps: CrosshairProps;
  FollowLatest: FollowLatest<Row>;
  FollowLatestRows: FollowLatestRows;
  FollowLatestTime: FollowLatestTime<Row>;
  GridProps: GridProps;
  LegendProps: LegendProps;
  LineProps: LineProps<Row>;
  MeterSemantics: MeterSemantics;
  MovingWindowOptions: MovingWindowOptions;
  PartitionOptions: PartitionOptions<Row>;
  PlotApi: PlotApi<Row>;
  PlotData: PlotData<Row>;
  PlotDataExportOptions: PlotDataExportOptions;
  PlotExportViewOptions: PlotExportViewOptions;
  PlotFactory: PlotFactory<Row>;
  PlotHeadingLevel: PlotHeadingLevel;
  PlotInteractionOrigin: PlotInteractionOrigin;
  PlotInteractionTarget: PlotInteractionTarget<Row>;
  PlotKey: PlotKey;
  PlotPngExportOptions: PlotPngExportOptions;
  PlotRowKey: PlotRowKey<Row>;
  PlotSelection: PlotSelection;
  PlotSummaryContext: PlotSummaryContext<Row>;
  PlotSvgExportOptions: PlotSvgExportOptions;
  PlotView: PlotView;
  PointProps: PointProps<Row>;
  RectProps: RectProps<Row>;
  RegressionOptions: RegressionOptions<Row>;
  RootProps: RootProps<Row>;
  RuleProps: RuleProps<Row>;
  ScaleProps: ScaleProps;
  ScaleType: ScaleType;
  ScaleValue: ScaleValue;
  SelectProps: SelectProps;
  SortRowsOptions: SortRowsOptions<Row>;
  StackOptions: StackOptions;
  TextProps: TextProps<Row>;
  TooltipProps: TooltipProps;
  TrimPlotRowsOptions: TrimPlotRowsOptions<Row>;
  WindowOperation: WindowOperation;
  ZoomProps: ZoomProps;
}

// Canonical wrapper annotations keep the concrete operation's constraints.
export const lineY: LineProps<Row>["y"] = "value";
export const histogramX: BarProps<Row>["x"] = bin("value");
export type DomainElement = NonNullable<ScaleProps["domain"]>[number];
export type LineComponent = PlotFactory<Row>["Line"];
export type PrimitiveName = Exclude<keyof PlotFactory<Row>, "Root">;
export const primitive: PrimitiveName = "Line";
// @ts-expect-error Root is excluded from the primitive-only selector
export const rootPrimitive: PrimitiveName = "Root";
export const colorExpression = constant("#2563eb");
export type ColorExpression = typeof colorExpression;
export const positiveRows = filterRows<Row>((row) => row.value > 0);
export type PositiveRowsTransform = typeof positiveRows;

// Every removed name must produce its own missing-export diagnostic.
// @ts-expect-error AggregatedNumericChannelInput is private in 0.5.0
export type Gone0 = import("@askrjs/charts").AggregatedNumericChannelInput<Row>;
// @ts-expect-error AggregateOperation is private in 0.5.0
export type Gone1 = import("@askrjs/charts").AggregateOperation;
// @ts-expect-error BinnedScaleChannelInput is private in 0.5.0
export type Gone2 = import("@askrjs/charts").BinnedScaleChannelInput<Row>;
// @ts-expect-error CartesianMarkProps is private in 0.5.0
export type Gone3 = import("@askrjs/charts").CartesianMarkProps<Row>;
// @ts-expect-error CategoricalField is private in 0.5.0
export type Gone4 = import("@askrjs/charts").CategoricalField<Row>;
// @ts-expect-error ChannelExpression is private in 0.5.0
export type Gone5 = import("@askrjs/charts").ChannelExpression<number>;
// @ts-expect-error ChannelExpressionKind is private in 0.5.0
export type Gone6 = import("@askrjs/charts").ChannelExpressionKind;
// @ts-expect-error ChannelInput is private in 0.5.0
export type Gone7 = import("@askrjs/charts").ChannelInput<Row, number>;
// @ts-expect-error ColorChannelInput is private in 0.5.0
export type Gone8 = import("@askrjs/charts").ColorChannelInput<Row>;
// @ts-expect-error FieldOfType is private in 0.5.0
export type Gone9 = import("@askrjs/charts").FieldOfType<Row, number>;
// @ts-expect-error MarkBaseProps is private in 0.5.0
export type Gone10 = import("@askrjs/charts").MarkBaseProps<Row>;
// @ts-expect-error NumericChannelInput is private in 0.5.0
export type Gone11 = import("@askrjs/charts").NumericChannelInput<Row>;
// @ts-expect-error NumericField is private in 0.5.0
export type Gone12 = import("@askrjs/charts").NumericField<Row>;
// @ts-expect-error PlotChannelValue is private in 0.5.0
export type Gone13 = import("@askrjs/charts").PlotChannelValue;
// @ts-expect-error PlotScalar is private in 0.5.0
export type Gone14 = import("@askrjs/charts").PlotScalar;
// @ts-expect-error PrimitiveComponent is private in 0.5.0
export type Gone15 = import("@askrjs/charts").PrimitiveComponent<unknown>;
// @ts-expect-error PrimitiveKind is private in 0.5.0
export type Gone16 = import("@askrjs/charts").PrimitiveKind;
// @ts-expect-error RowAccessor is private in 0.5.0
export type Gone17 = import("@askrjs/charts").RowAccessor<Row, number>;
// @ts-expect-error RowChannelInput is private in 0.5.0
export type Gone18 = import("@askrjs/charts").RowChannelInput<Row, number>;
// @ts-expect-error RowColorChannelInput is private in 0.5.0
export type Gone19 = import("@askrjs/charts").RowColorChannelInput<Row>;
// @ts-expect-error RowField is private in 0.5.0
export type Gone20 = import("@askrjs/charts").RowField<Row>;
// @ts-expect-error RowNumericChannelInput is private in 0.5.0
export type Gone21 = import("@askrjs/charts").RowNumericChannelInput<Row>;
// @ts-expect-error RowScaleChannelInput is private in 0.5.0
export type Gone22 = import("@askrjs/charts").RowScaleChannelInput<Row>;
// @ts-expect-error RowTextChannelInput is private in 0.5.0
export type Gone23 = import("@askrjs/charts").RowTextChannelInput<Row>;
// @ts-expect-error RowTransform is private in 0.5.0
export type Gone24 = import("@askrjs/charts").RowTransform<Row>;
// @ts-expect-error RowTransformKind is private in 0.5.0
export type Gone25 = import("@askrjs/charts").RowTransformKind;
// @ts-expect-error ScaleChannelInput is private in 0.5.0
export type Gone26 = import("@askrjs/charts").ScaleChannelInput<Row>;
// @ts-expect-error ScaleDomainValue is private in 0.5.0
export type Gone27 = import("@askrjs/charts").ScaleDomainValue;
// @ts-expect-error ScaleField is private in 0.5.0
export type Gone28 = import("@askrjs/charts").ScaleField<Row>;
// @ts-expect-error TemporalField is private in 0.5.0
export type Gone29 = import("@askrjs/charts").TemporalField<Row>;
// @ts-expect-error TextChannelInput is private in 0.5.0
export type Gone30 = import("@askrjs/charts").TextChannelInput<Row>;

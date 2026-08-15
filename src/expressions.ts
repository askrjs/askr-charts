import type {
  BinOptions,
  ChannelExpression,
  ChannelInput,
  MovingWindowOptions,
  NumericChannelInput,
  PartitionOptions,
  RegressionOptions,
  RowTransform,
  SortRowsOptions,
  StackOptions,
} from "./model";

type AnyExpression = ChannelExpression<unknown, string>;

function expression<
  Value,
  Field extends string = never,
  Kind extends ChannelExpression<Value, Field>["kind"] = ChannelExpression<Value, Field>["kind"],
>(
  kind: Kind,
  input?: unknown,
  options: Readonly<Record<string, unknown>> = {},
): ChannelExpression<Value, Field, Kind> {
  return Object.freeze({
    __askrPlotExpression: true as const,
    kind,
    input,
    options: Object.freeze({ ...options }),
  }) as ChannelExpression<Value, Field, Kind>;
}

function transform<Row>(
  kind: RowTransform<Row>["kind"],
  options: Readonly<Record<string, unknown>>,
): RowTransform<Row> {
  return Object.freeze({
    __askrPlotTransform: true as const,
    kind,
    options: Object.freeze({ ...options }),
  }) as RowTransform<Row>;
}

export function isChannelExpression(value: unknown): value is AnyExpression {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __askrPlotExpression?: unknown }).__askrPlotExpression === true
  );
}

export function isRowTransform<Row = unknown>(value: unknown): value is RowTransform<Row> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __askrPlotTransform?: unknown }).__askrPlotTransform === true
  );
}

/** A channel expression that always resolves to the same fixed value for every row. */
export function constant<Value>(value: Value): ChannelExpression<Value, never, "constant"> {
  return expression("constant", undefined, { value });
}

/** Bins a numeric or temporal channel into discrete intervals. */
export function bin<Field extends string>(
  input: Field,
  options?: BinOptions,
): ChannelExpression<number | Date, Field, "bin">;
export function bin<Row>(
  input: ChannelInput<Row, number | Date>,
  options?: BinOptions,
): ChannelExpression<number | Date, never, "bin">;
export function bin(
  input: unknown,
  options: BinOptions = {},
): ChannelExpression<number | Date, string, "bin"> {
  return expression("bin", input, options as Readonly<Record<string, unknown>>);
}

/** Counts the number of rows in each group. */
export function count(): ChannelExpression<number, never, "count"> {
  return expression("count");
}

/** Sums a numeric channel across each group. */
export function sum<Field extends string>(input: Field): ChannelExpression<number, Field, "sum">;
export function sum<Row>(input: NumericChannelInput<Row>): ChannelExpression<number, never, "sum">;
export function sum(input: unknown): ChannelExpression<number, string, "sum"> {
  return expression("sum", input);
}

/** Averages a numeric channel across each group. */
export function mean<Field extends string>(input: Field): ChannelExpression<number, Field, "mean">;
export function mean<Row>(
  input: NumericChannelInput<Row>,
): ChannelExpression<number, never, "mean">;
export function mean(input: unknown): ChannelExpression<number, string, "mean"> {
  return expression("mean", input);
}

/** Groups rows by a channel's distinct values. */
export function group<Field extends string>(
  input: Field,
): ChannelExpression<unknown, Field, "group">;
export function group<Row, Value>(
  input: ChannelInput<Row, Value>,
): ChannelExpression<Value, never, "group">;
export function group(input: unknown): ChannelExpression<unknown, string, "group"> {
  return expression("group", input);
}

/** Stacks a numeric channel's values within each group, e.g. for stacked bar/area charts. */
export function stack<Field extends string>(
  input: Field,
  options?: StackOptions,
): ChannelExpression<number, Field, "stack">;
export function stack<Row>(
  input: NumericChannelInput<Row>,
  options?: StackOptions,
): ChannelExpression<number, never, "stack">;
export function stack(
  input: unknown,
  options: StackOptions = {},
): ChannelExpression<number, string, "stack"> {
  return expression("stack", input, options as Readonly<Record<string, unknown>>);
}

/** Normalizes a numeric channel's values within each group to a 0–1 (or proportional) range. */
export function normalize<Field extends string>(
  input: Field,
): ChannelExpression<number, Field, "normalize">;
export function normalize<Row>(
  input: NumericChannelInput<Row>,
): ChannelExpression<number, never, "normalize">;
export function normalize(input: unknown): ChannelExpression<number, string, "normalize"> {
  return expression("normalize", input);
}

/** Applies a sliding-window aggregate (sum, mean, min, or max) to a numeric channel. */
export function movingWindow<Field extends string>(
  input: Field,
  options: MovingWindowOptions,
): ChannelExpression<number, Field, "moving-window">;
export function movingWindow<Row>(
  input: NumericChannelInput<Row>,
  options: MovingWindowOptions,
): ChannelExpression<number, never, "moving-window">;
export function movingWindow(
  input: unknown,
  options: MovingWindowOptions,
): ChannelExpression<number, string, "moving-window"> {
  return expression(
    "moving-window",
    input,
    options as unknown as Readonly<Record<string, unknown>>,
  );
}

/** Shorthand for {@link movingWindow} with `operation: "mean"`. */
export function movingAverage<Field extends string>(
  input: Field,
  options: Omit<MovingWindowOptions, "operation">,
): ChannelExpression<number, Field, "moving-average">;
export function movingAverage<Row>(
  input: NumericChannelInput<Row>,
  options: Omit<MovingWindowOptions, "operation">,
): ChannelExpression<number, never, "moving-average">;
export function movingAverage(
  input: unknown,
  options: Omit<MovingWindowOptions, "operation">,
): ChannelExpression<number, string, "moving-average"> {
  return expression("moving-average", input, {
    ...options,
    operation: "mean",
  });
}

/** Fits a regression curve (currently linear) to a numeric channel against an x channel. */
export function regression<Field extends string>(
  input: Field,
  options?: { x?: string; method?: "linear" },
): ChannelExpression<number, Field, "regression">;
export function regression<Row>(
  input: NumericChannelInput<Row>,
  options?: RegressionOptions<Row>,
): ChannelExpression<number, never, "regression">;
export function regression(
  input: unknown,
  options: unknown = {},
): ChannelExpression<number, string, "regression"> {
  return expression("regression", input, options as Readonly<Record<string, unknown>>);
}

/** A row transform that keeps only rows for which `predicate` returns true. */
export function filterRows<Row>(
  predicate: (row: Readonly<Row>, index: number) => boolean,
): RowTransform<Row> {
  return transform("filter", { predicate });
}

/** A row transform that sorts rows by a field or accessor. */
export function sortRows<Row>(options: SortRowsOptions<Row>): RowTransform<Row> {
  return transform("sort", options as unknown as Readonly<Record<string, unknown>>);
}

/** A row transform that builds a hierarchy (e.g. for treemap/icicle-style marks) from flat rows. */
export function partition<Row>(options: PartitionOptions<Row>): RowTransform<Row> {
  return transform("partition", options as unknown as Readonly<Record<string, unknown>>);
}

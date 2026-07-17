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

export function constant<Value>(value: Value): ChannelExpression<Value, never, "constant"> {
  return expression("constant", undefined, { value });
}

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

export function count(): ChannelExpression<number, never, "count"> {
  return expression("count");
}

export function sum<Field extends string>(input: Field): ChannelExpression<number, Field, "sum">;
export function sum<Row>(input: NumericChannelInput<Row>): ChannelExpression<number, never, "sum">;
export function sum(input: unknown): ChannelExpression<number, string, "sum"> {
  return expression("sum", input);
}

export function mean<Field extends string>(input: Field): ChannelExpression<number, Field, "mean">;
export function mean<Row>(
  input: NumericChannelInput<Row>,
): ChannelExpression<number, never, "mean">;
export function mean(input: unknown): ChannelExpression<number, string, "mean"> {
  return expression("mean", input);
}

export function group<Field extends string>(
  input: Field,
): ChannelExpression<unknown, Field, "group">;
export function group<Row, Value>(
  input: ChannelInput<Row, Value>,
): ChannelExpression<Value, never, "group">;
export function group(input: unknown): ChannelExpression<unknown, string, "group"> {
  return expression("group", input);
}

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

export function normalize<Field extends string>(
  input: Field,
): ChannelExpression<number, Field, "normalize">;
export function normalize<Row>(
  input: NumericChannelInput<Row>,
): ChannelExpression<number, never, "normalize">;
export function normalize(input: unknown): ChannelExpression<number, string, "normalize"> {
  return expression("normalize", input);
}

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

export function filterRows<Row>(
  predicate: (row: Readonly<Row>, index: number) => boolean,
): RowTransform<Row> {
  return transform("filter", { predicate });
}

export function sortRows<Row>(options: SortRowsOptions<Row>): RowTransform<Row> {
  return transform("sort", options as unknown as Readonly<Record<string, unknown>>);
}

export function partition<Row>(options: PartitionOptions<Row>): RowTransform<Row> {
  return transform("partition", options as unknown as Readonly<Record<string, unknown>>);
}

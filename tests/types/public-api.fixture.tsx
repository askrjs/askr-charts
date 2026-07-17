import {
  bin,
  constant,
  count,
  createPlot,
  filterRows,
  movingAverage,
  sum,
  type PlotApi,
  type PlotView,
} from "@askrjs/charts";

interface LatencyRow {
  id: string;
  timestamp: Date;
  latency: number;
  p95?: number;
  outcome: "ok" | "error";
  active: boolean;
}

const rows = [] as readonly LatencyRow[];
const Latency = createPlot<LatencyRow>();
let api: PlotApi<LatencyRow> | null = null;
const namedView: PlotView = {
  x: [new Date(0), new Date(1_000)],
  scales: { latency: [0, 100] },
};

const validPlot = (
  <Latency.Root
    data={rows}
    rowKey="id"
    label="Latency"
    onApiChange={(nextApi) => {
      api = nextApi;
    }}
    defaultView={namedView}
  >
    <Latency.Scale
      name="active-color"
      channel="color"
      type="ordinal-color"
      domain={[true, false]}
    />
    <Latency.Bar
      x={bin("latency", { thresholds: 20 })}
      y={count()}
      fill="outcome"
      transform={filterRows<LatencyRow>((row) => row.active)}
    />
    <Latency.Line
      x={(row, index) => (index >= 0 ? row.timestamp : null)}
      y={movingAverage("p95", { window: 7 })}
      stroke={constant("#0b7285")}
    />
    <Latency.Point x="timestamp" y={(row) => row.latency} fill="outcome" />
    <Latency.Area x="timestamp" y={sum("latency")} />
    <Latency.Bar
      x={bin<LatencyRow>((row) => row.latency)}
      y={sum<LatencyRow>((row) => row.latency)}
    />
  </Latency.Root>
);

void validPlot;
void api;

// @ts-expect-error interactive view domains do not accept boolean values
const invalidBooleanView: PlotView = { x: [true, false] };

// @ts-expect-error React-style className is not part of the Askr root contract
const legacyClassName = <Latency.Root data={rows} rowKey="id" label="Latency" className="legacy" />;

const legacyApiRef = (
  // @ts-expect-error imperative object refs are replaced by the semantic callback
  <Latency.Root data={rows} rowKey="id" label="Latency" apiRef={{ current: null }} />
);

// @ts-expect-error unknown row fields are not valid channels
const wrongField = <Latency.Line x="missing" y="latency" />;

// @ts-expect-error categorical fields are not valid numeric channels
const wrongChannelType = <Latency.Line x="timestamp" y="outcome" />;

// @ts-expect-error accessors must return a value accepted by the channel
const wrongAccessorType = <Latency.Point x={(row) => row.active} y="latency" />;

const wrongExpressionField = (
  // @ts-expect-error field-based numeric expressions retain their field constraint
  <Latency.Line x="timestamp" y={movingAverage("outcome", { window: 3 })} />
);

// @ts-expect-error binning changes row cardinality and is only supported by Bar and Area x channels
const unsupportedLineBin = <Latency.Line x={bin("latency")} y="latency" />;

// @ts-expect-error grouped aggregates are only supported by Bar and Area y channels
const unsupportedPointAggregate = <Latency.Point x="timestamp" y={count()} />;

// @ts-expect-error pie and gauge arcs consume per-row values rather than grouped aggregates
const unsupportedArcAggregate = <Latency.Arc value={sum("latency")} />;

// @ts-expect-error constant colors use constant() so strings remain unambiguous row fields
const ambiguousConstantColor = <Latency.Point x="timestamp" y="latency" fill="#0b7285" />;

// @ts-expect-error a Date-valued field cannot be used as the stable PlotKey
const wrongRowKey = <Latency.Root data={rows} rowKey="timestamp" label="Latency" />;

void wrongField;
void wrongChannelType;
void wrongAccessorType;
void wrongExpressionField;
void unsupportedLineBin;
void unsupportedPointAggregate;
void unsupportedArcAggregate;
void ambiguousConstantColor;
void wrongRowKey;
void invalidBooleanView;
void legacyClassName;
void legacyApiRef;

// Factory identity is intentionally enforced while compiling descriptors at runtime. Askr's
// JSXElement type erases the component that created an element, so declarations cannot claim
// compile-time mixed-factory rejection without introducing a false brand on all JSX children.

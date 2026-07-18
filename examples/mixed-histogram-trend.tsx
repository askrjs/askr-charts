import { bin, constant, count, createPlot, movingAverage } from "@askrjs/charts";

type LatencyRow = {
  id: string;
  timestamp: Date;
  latencyMs: number | null;
  p95: number;
  outcome: "ok" | "error";
};

const LatencyPlot = createPlot<LatencyRow>();

const rows: readonly LatencyRow[] = [
  {
    id: "request-1",
    timestamp: new Date("2026-07-17T12:00:00Z"),
    latencyMs: 82,
    p95: 184,
    outcome: "ok",
  },
  {
    id: "request-2",
    timestamp: new Date("2026-07-17T12:01:00Z"),
    latencyMs: 136,
    p95: 192,
    outcome: "ok",
  },
  {
    id: "request-3",
    timestamp: new Date("2026-07-17T12:02:00Z"),
    latencyMs: 418,
    p95: 221,
    outcome: "error",
  },
  {
    id: "request-4",
    timestamp: new Date("2026-07-17T12:03:00Z"),
    latencyMs: null,
    p95: 205,
    outcome: "error",
  },
];

export function MixedHistogramTrend() {
  return (
    <LatencyPlot.Root
      data={rows}
      rowKey="id"
      label="Latency distribution and P95 trend"
      title="Request latency"
      description="Histogram bins by outcome with the rolling P95 trend on UTC time."
      summary={({ sourceRowCount, omittedRowCount }) =>
        `${sourceRowCount} requests; ${omittedRowCount} invalid measurements omitted.`
      }
    >
      <LatencyPlot.Scale name="latency-x" channel="x" type="linear" nice />
      <LatencyPlot.Scale name="time-x" channel="x" type="utc" nice />
      <LatencyPlot.Scale name="count-y" channel="y" type="linear" nice />
      <LatencyPlot.Scale name="p95-y" channel="y" type="symlog" constant={10} nice />
      <LatencyPlot.Scale
        name="outcome-color"
        channel="color"
        type="ordinal-color"
        domain={["ok", "error"]}
        range={["#059669", "#dc2626"]}
      />

      <LatencyPlot.Bar
        x={bin("latencyMs", { thresholds: 12 })}
        y={count()}
        fill="outcome"
        stack="outcome"
        xScale="latency-x"
        yScale="count-y"
        colorScale="outcome-color"
      />
      <LatencyPlot.Line
        x="timestamp"
        y={movingAverage("p95", { window: 3 })}
        xScale="time-x"
        yScale="p95-y"
        stroke={constant("#7c3aed")}
        curve="monotone"
      />
      <LatencyPlot.Point
        x="timestamp"
        y="p95"
        xScale="time-x"
        yScale="p95-y"
        fill={constant("#7c3aed")}
      />

      <LatencyPlot.Axis scale="latency-x" orient="bottom" label="Latency (ms)" />
      <LatencyPlot.Axis scale="time-x" orient="top" label="Time (UTC)" />
      <LatencyPlot.Axis scale="count-y" orient="left" label="Requests" />
      <LatencyPlot.Axis scale="p95-y" orient="right" label="P95 (ms)" />
      <LatencyPlot.Grid scale="p95-y" axis="y" />
      <LatencyPlot.Legend scale="outcome-color" label="Outcome" interactive />
      <LatencyPlot.Tooltip channels={["timestamp", "latencyMs", "p95", "outcome"]} />
      <LatencyPlot.Crosshair axes="xy" />
      <LatencyPlot.Zoom axes="xy" />
      <LatencyPlot.Brush axis="x" modifier="shift" />
    </LatencyPlot.Root>
  );
}

import { constant, createPlot, partition } from "@askrjs/charts";

type CartesianRow = {
  id: string;
  timestamp: Date;
  category: string;
  value: number;
  low: number;
  high: number;
  weight: number;
};

type ShareRow = { id: string; category: string; value: number };
type HeatRow = { id: string; day: string; hour: string; requests: number };
type FrameRow = {
  id: string;
  parentId: string | null;
  label: string;
  service: string;
  durationMs: number;
};
type TimelineRow = {
  id: string;
  startedAt: Date;
  finishedAt: Date;
  lane: number;
  label: string;
};
type MeterRow = { id: string; label: string; value: number };

const CartesianPlot = createPlot<CartesianRow>();
const SharePlot = createPlot<ShareRow>();
const HeatPlot = createPlot<HeatRow>();
const TracePlot = createPlot<FrameRow>();
const TimelinePlot = createPlot<TimelineRow>();
const ProgressPlot = createPlot<MeterRow>();
const GaugePlot = createPlot<MeterRow>();

const cartesianRows: readonly CartesianRow[] = [
  {
    id: "mon",
    timestamp: new Date("2026-07-13T00:00:00Z"),
    category: "router",
    value: 18,
    low: 14,
    high: 22,
    weight: 4,
  },
  {
    id: "tue",
    timestamp: new Date("2026-07-14T00:00:00Z"),
    category: "data",
    value: 24,
    low: 19,
    high: 28,
    weight: 6,
  },
  {
    id: "wed",
    timestamp: new Date("2026-07-15T00:00:00Z"),
    category: "forms",
    value: 21,
    low: 17,
    high: 25,
    weight: 5,
  },
];

const shareRows: readonly ShareRow[] = [
  { id: "router", category: "Router", value: 42 },
  { id: "data", category: "Data", value: 35 },
  { id: "forms", category: "Forms", value: 23 },
];

const heatRows: readonly HeatRow[] = [
  { id: "mon-09", day: "Mon", hour: "09:00", requests: 14 },
  { id: "mon-10", day: "Mon", hour: "10:00", requests: 22 },
  { id: "tue-09", day: "Tue", hour: "09:00", requests: 18 },
  { id: "tue-10", day: "Tue", hour: "10:00", requests: 27 },
];

const frames: readonly FrameRow[] = [
  {
    id: "request",
    parentId: null,
    label: "HTTP request",
    service: "edge",
    durationMs: 246,
  },
  {
    id: "auth",
    parentId: "request",
    label: "Authenticate",
    service: "edge",
    durationMs: 42,
  },
  {
    id: "query",
    parentId: "request",
    label: "Query",
    service: "database",
    durationMs: 154,
  },
  {
    id: "shape",
    parentId: "request",
    label: "Shape response",
    service: "api",
    durationMs: 50,
  },
];

const timelineRows: readonly TimelineRow[] = [
  {
    id: "deploy",
    startedAt: new Date("2026-07-17T12:00:00Z"),
    finishedAt: new Date("2026-07-17T12:08:00Z"),
    lane: 1,
    label: "Deploy",
  },
  {
    id: "verify",
    startedAt: new Date("2026-07-17T12:08:00Z"),
    finishedAt: new Date("2026-07-17T12:15:00Z"),
    lane: 2,
    label: "Verify",
  },
];

const progressRows: readonly MeterRow[] = [
  { id: "migration", label: "Migration", value: 64 },
];
const gaugeRows: readonly MeterRow[] = [
  { id: "storage", label: "Storage", value: 72 },
];

export function MarkFamilies() {
  return (
    <>
      <CartesianPlot.Root
        data={cartesianRows}
        rowKey="id"
        label="Cartesian mark families"
      >
        <CartesianPlot.Bar
          x="timestamp"
          y="value"
          fill="category"
          opacity={0.32}
        />
        <CartesianPlot.Area
          x="timestamp"
          y="high"
          y2="low"
          fill={constant("#2563eb")}
        />
        <CartesianPlot.Line
          x="timestamp"
          y="value"
          stroke={constant("#7c3aed")}
        />
        <CartesianPlot.Point
          x="timestamp"
          y="value"
          r="weight"
          shape="diamond"
        />
        <CartesianPlot.Legend interactive />
        <CartesianPlot.Tooltip />
      </CartesianPlot.Root>

      <SharePlot.Root
        data={shareRows}
        rowKey="id"
        label="Subsystem event share"
      >
        <SharePlot.Arc
          value="value"
          category="category"
          innerRadius={48}
          padAngle={0.02}
          cornerRadius={6}
        />
        <SharePlot.Legend interactive position="bottom" />
        <SharePlot.Tooltip channels={["category", "value"]} />
      </SharePlot.Root>

      <HeatPlot.Root data={heatRows} rowKey="id" label="Request heatmap">
        <HeatPlot.Cell x="day" y="hour" value="requests" inset={1} />
        <HeatPlot.Legend label="Requests" />
        <HeatPlot.Tooltip channels={["day", "hour", "requests"]} />
      </HeatPlot.Root>

      <TracePlot.Root data={frames} rowKey="id" label="Request flame graph">
        <TracePlot.Rect
          transform={partition<FrameRow>({
            id: "id",
            parentId: "parentId",
            value: "durationMs",
            padding: 0.004,
          })}
          fill="service"
          title="label"
        />
        <TracePlot.Legend interactive label="Service" />
        <TracePlot.Tooltip channels={["label", "durationMs"]} />
      </TracePlot.Root>

      <TimelinePlot.Root
        data={timelineRows}
        rowKey="id"
        label="Release timeline"
      >
        <TimelinePlot.Rule
          x="startedAt"
          x2="finishedAt"
          y="lane"
          strokeWidth={4}
        />
        <TimelinePlot.Point x="startedAt" y="lane" />
        <TimelinePlot.Text x="startedAt" y="lane" text="label" align="left" />
        <TimelinePlot.Tooltip channels={["label", "startedAt", "finishedAt"]} />
      </TimelinePlot.Root>

      <ProgressPlot.Root
        data={progressRows}
        rowKey="id"
        label="Migration progress"
        meter={{ role: "meter", min: 0, max: 100, value: 64, valueText: "64%" }}
      >
        <ProgressPlot.Bar
          x="label"
          y="value"
          min={0}
          max={100}
          orientation="horizontal"
        />
      </ProgressPlot.Root>

      <GaugePlot.Root
        data={gaugeRows}
        rowKey="id"
        label="Storage used"
        meter={{ role: "meter", min: 0, max: 100, value: 72, valueText: "72%" }}
      >
        <GaugePlot.Arc
          value="value"
          min={0}
          max={100}
          startAngle={-Math.PI}
          endAngle={0}
          cornerRadius={8}
          fill={constant("#059669")}
        />
      </GaugePlot.Root>
    </>
  );
}

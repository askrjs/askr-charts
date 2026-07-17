import { state } from "@askrjs/askr";
import {
  appendPlotRows,
  createPlot,
  trimPlotRows,
  type PlotApi,
  type PlotSelection,
  type PlotView,
} from "@askrjs/charts";

type LiveRow = {
  id: string;
  timestamp: Date;
  latencyMs: number;
  service: "api" | "worker";
};

const LivePlot = createPlot<LiveRow>();

const initialRows: readonly LiveRow[] = [
  {
    id: "sample-1",
    timestamp: new Date("2026-07-17T12:00:00Z"),
    latencyMs: 124,
    service: "api",
  },
  {
    id: "sample-2",
    timestamp: new Date("2026-07-17T12:01:00Z"),
    latencyMs: 158,
    service: "worker",
  },
];

let nextSample = initialRows.length + 1;

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LiveInteractionsExport() {
  const [rows, setRows] = state<readonly LiveRow[]>(initialRows);
  const [view, setView] = state<PlotView>({});
  const [selection, setSelection] = state<PlotSelection>({ keys: [] });
  const [api, setApi] = state<PlotApi<LiveRow> | null>(null);

  const appendSample = () => {
    const sample = nextSample++;
    const next: LiveRow = {
      id: `sample-${sample}`,
      timestamp: new Date(),
      latencyMs: 110 + ((sample * 29) % 120),
      service: sample % 2 === 0 ? "api" : "worker",
    };
    setRows((current) =>
      trimPlotRows(appendPlotRows(current, next), {
        durationMs: 5 * 60_000,
        field: "timestamp",
      }),
    );
  };

  const exportPng = async () => {
    const blob = await api()?.exportPng({ view: "current", pixelRatio: 2 });
    if (blob) download(blob, "live-latency.png");
  };

  const exportSvg = () => {
    const svg = api()?.exportSvg({ view: "full" });
    if (svg) download(new Blob([svg], { type: "image/svg+xml" }), "live-latency.svg");
  };

  const exportSelected = () => {
    const csv = api()?.exportData({
      view: "current",
      rows: "transformed",
      scope: "selected",
      format: "csv",
    });
    if (csv) download(new Blob([csv], { type: "text/csv" }), "selected-latency.csv");
  };

  return (
    <section>
      <LivePlot.Root
        data={rows}
        rowKey="id"
        label="Live service latency"
        title="Live latency"
        description="Pan or zoom to pause follow-latest; resume it explicitly."
        view={view()}
        onViewChange={(next) => setView(next)}
        selection={selection()}
        onSelectionChange={(next) => setSelection(next)}
        onActivate={(row) => setSelection({ keys: [row.id] })}
        followLatest={{ durationMs: 5 * 60_000, field: "timestamp" }}
        apiRef={(next) => setApi(next)}
      >
        <LivePlot.Line x="timestamp" y="latencyMs" stroke="service" />
        <LivePlot.Point x="timestamp" y="latencyMs" fill="service" />
        <LivePlot.Legend interactive label="Service" />
        <LivePlot.Tooltip channels={["timestamp", "latencyMs", "service"]} />
        <LivePlot.Crosshair axes="xy" />
        <LivePlot.Zoom axes="xy" wheel pinch pan />
        <LivePlot.Brush axis="x" modifier="shift" />
      </LivePlot.Root>

      <div>
        <button type="button" onClick={appendSample}>
          Add sample
        </button>
        <button type="button" onClick={() => api()?.resumeLive()}>
          Resume live
        </button>
        <button type="button" onClick={() => api()?.resetView()}>
          Reset view
        </button>
        <button type="button" onClick={exportPng}>
          Export PNG
        </button>
        <button type="button" onClick={exportSvg}>
          Export SVG
        </button>
        <button type="button" onClick={exportSelected}>
          Export selected CSV
        </button>
      </div>
    </section>
  );
}

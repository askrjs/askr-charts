import { describe, expect, it } from "vite-plus/test";

import { compilePlotScene } from "../src/compiler";
import type { PlotDescriptor } from "../src/descriptors";
import { serializePlotData, serializePlotSvg } from "../src/export";
import { bin, count, filterRows, sum } from "../src/expressions";
import type { PrimitiveKind } from "../src/model";
import type {
  PlotScene,
  SceneMark,
  SceneMarkBase,
  ScenePoint,
} from "../src/scene-model";

interface Row {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly when: Date;
  readonly metadata: Readonly<{ ok: boolean }>;
}

const rows: readonly Row[] = Object.freeze([
  Object.freeze({
    id: "a",
    label: 'A, "quoted"\nnext',
    value: 1,
    when: new Date("2026-01-01T00:00:00.000Z"),
    metadata: Object.freeze({ ok: true }),
  }),
  Object.freeze({
    id: "b",
    label: "Hidden",
    value: 2,
    when: new Date("2026-01-02T00:00:00.000Z"),
    metadata: Object.freeze({ ok: false }),
  }),
  Object.freeze({
    id: "c",
    label: "Missing number",
    value: Number.NaN,
    when: new Date("2026-01-03T00:00:00.000Z"),
    metadata: Object.freeze({ ok: true }),
  }),
]);

function base(
  id: string,
  title = id,
  series: string | null = null,
): SceneMarkBase<Row> {
  return {
    id,
    key: id,
    sourceIndex: 0,
    row: rows[0]!,
    fill: "#2563eb",
    stroke: "#18181b",
    opacity: 0.8,
    title,
    series,
    channels: Object.freeze({ value: 1 }),
  };
}

function point(x: number, y: number, sourceIndex: number): ScenePoint {
  return { x, y, sourceIndex, key: sourceIndex };
}

function everyMark(): readonly SceneMark<Row>[] {
  const points = Object.freeze([
    point(10, 30, 0),
    point(20, 20, 1),
    point(30, 25, 2),
  ]);
  const baseline = Object.freeze([
    point(10, 45, 0),
    point(20, 45, 1),
    point(30, 45, 2),
  ]);
  return Object.freeze([
    {
      ...base("bar", "<bar>&"),
      kind: "bar",
      x: 10,
      y: 10,
      width: 8,
      height: 20,
      radius: 2,
    },
    {
      ...base("cell"),
      kind: "cell",
      x: 20,
      y: 10,
      width: 8,
      height: 8,
      radius: 0,
    },
    {
      ...base("rect"),
      kind: "rect",
      x: 30,
      y: 10,
      width: 12,
      height: 8,
      radius: 1,
    },
    {
      ...base("line", "line", "trend"),
      kind: "line",
      segments: Object.freeze([points]),
      points,
      curve: "monotone",
      strokeWidth: 2,
    },
    { ...base("area"), kind: "area", points, baseline, curve: "linear" },
    {
      ...base("point-circle"),
      kind: "point",
      x: 45,
      y: 20,
      radius: 3,
      shape: "circle",
    },
    {
      ...base("point-square"),
      kind: "point",
      x: 55,
      y: 20,
      radius: 3,
      shape: "square",
    },
    {
      ...base("point-diamond"),
      kind: "point",
      x: 65,
      y: 20,
      radius: 3,
      shape: "diamond",
    },
    {
      ...base("arc"),
      kind: "arc",
      cx: 80,
      cy: 30,
      innerRadius: 5,
      outerRadius: 12,
      startAngle: 0,
      endAngle: Math.PI * 1.5,
      padAngle: 0,
      cornerRadius: 0,
    },
    {
      ...base("rule"),
      kind: "rule",
      x1: 5,
      y1: 50,
      x2: 95,
      y2: 50,
      strokeWidth: 1,
      dash: Object.freeze([4, 2]),
    },
    {
      ...base("text"),
      kind: "text",
      x: 50,
      y: 60,
      text: '5 < 7 & "safe"',
      align: "center",
      baseline: "middle",
      font: "12px sans-serif",
    },
  ] satisfies SceneMark<Row>[]);
}

function scene(marks: readonly SceneMark<Row>[] = everyMark()): PlotScene<Row> {
  return {
    width: 100,
    height: 80,
    pixelRatio: 2,
    plotArea: Object.freeze({ x: 5, y: 5, width: 90, height: 60 }),
    scales: Object.freeze({}),
    axes: Object.freeze([
      Object.freeze({
        id: "x",
        scale: "x",
        orientation: "bottom",
        label: null,
        ticks: Object.freeze([
          Object.freeze({ value: 0, position: 10, label: "<zero> & one" }),
        ]),
        grid: true,
      }),
    ]),
    grids: Object.freeze([
      Object.freeze({
        id: "grid-x",
        scale: "x",
        axis: "x",
        positions: Object.freeze([10, 20]),
      }),
      Object.freeze({
        id: "grid-y",
        scale: "y",
        axis: "y",
        positions: Object.freeze([30]),
      }),
    ]),
    marks,
    hits: Object.freeze([]),
    legends: Object.freeze([]),
    interactions: Object.freeze({
      tooltip: true,
      crosshair: null,
      zoom: null,
      brush: null,
    }),
    sourceRows: rows,
    sourceRowRecords: Object.freeze([
      Object.freeze({ row: rows[0]!, key: "a", sourceIndex: 0, visible: true }),
      Object.freeze({
        row: rows[1]!,
        key: "b",
        sourceIndex: 1,
        visible: false,
      }),
      Object.freeze({ row: rows[2]!, key: "c", sourceIndex: 2, visible: true }),
    ]),
    transformedRows: Object.freeze([
      Object.freeze({
        row: rows[0]!,
        key: "a",
        sourceIndex: 0,
        sourceKeys: Object.freeze(["a"]),
        visible: true,
        values: Object.freeze({ bucket: "one", computed: 10 }),
      }),
      Object.freeze({
        row: rows[1]!,
        key: "b",
        sourceIndex: 1,
        sourceKeys: Object.freeze(["b"]),
        visible: false,
        values: Object.freeze({ bucket: "two", computed: 20 }),
      }),
      Object.freeze({
        row: rows[2]!,
        key: "c",
        sourceIndex: 2,
        sourceKeys: Object.freeze(["c"]),
        visible: true,
        values: Object.freeze({
          bucket: "three",
          computed: Number.POSITIVE_INFINITY,
        }),
      }),
    ]),
    omittedRowCount: 0,
    visibleRowCount: 2,
    diagnostics: Object.freeze([]),
    summary: 'Revenue <Q1> & "best"',
    empty: false,
  };
}

function descriptor(
  kind: PrimitiveKind,
  props: Readonly<Record<string, unknown>> = {},
): PlotDescriptor {
  return Object.freeze({ kind, props: Object.freeze({ ...props }) });
}

describe("SVG scene serialization", () => {
  it("should serialize every mark family given a hand-built scene when exporting SVG", () => {
    const svg = serializePlotSvg(scene());

    expect(
      svg.startsWith(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"',
      ),
    ).toBe(true);
    for (const mark of [
      "bar",
      "cell",
      "rect",
      "line",
      "area",
      "arc",
      "rule",
      "text",
    ]) {
      expect(svg).toContain(`data-mark="${mark}"`);
    }
    expect(svg.match(/data-mark="point"/g)).toHaveLength(3);
    expect(svg).toContain('<circle data-mark="point"');
    expect(svg).toContain('<rect data-mark="point"');
    expect(svg).toContain('<polygon data-mark="point"');
    expect(svg).toContain('<g clip-path="url(#plot-clip)">');
    expect(svg).toContain('stroke-dasharray="4 2"');
  });

  it("should escape summaries labels titles paints and text given hostile strings when exporting SVG", () => {
    const hostile = {
      ...base("hostile", '<script>alert("title")</script>'),
      kind: "text" as const,
      x: 10,
      y: 10,
      text: '<script>alert("text")</script>',
      align: "left" as const,
      baseline: "alphabetic" as const,
      font: "12px sans-serif",
      fill: '#fff"/><script>alert("paint")</script>',
    };

    const svg = serializePlotSvg(scene([hostile]), {
      background: '#fff" onload="alert(1)',
    });

    expect(svg).toContain(
      "<title>Revenue &lt;Q1&gt; &amp; &quot;best&quot;</title>",
    );
    expect(svg).toContain("&lt;zero&gt; &amp; one");
    expect(svg).toContain(
      "&lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt;",
    );
    expect(svg).toContain(
      "&lt;script&gt;alert(&quot;text&quot;)&lt;/script&gt;",
    );
    expect(svg).toContain(
      'fill="#fff&quot;/&gt;&lt;script&gt;alert(&quot;paint&quot;)&lt;/script&gt;"',
    );
    expect(svg).toContain('fill="#fff&quot; onload=&quot;alert(1)"');
    expect(svg).not.toContain("<script>");
  });

  it("should omit filtered series and honor background overrides given export options when serializing", () => {
    const svg = serializePlotSvg(scene(), {
      background: "#101010",
      hiddenSeries: new Set(["trend"]),
    });

    expect(svg).toContain('<rect width="100%" height="100%" fill="#101010"/>');
    expect(svg).not.toContain('data-mark="line"');
    expect(svg).toContain('data-mark="bar"');
  });

  it("should exclude transient overlays by default and include requested overlays and selection", () => {
    const plain = serializePlotSvg(scene(), {
      selectedKeys: new Set(["bar"]),
    });
    const withOverlays = serializePlotSvg(scene(), {
      includeOverlays: true,
      selectedKeys: new Set(["bar"]),
      overlays: {
        crosshair: { x: 24, y: 30, axes: "xy" },
        brush: { x0: 10, y0: 12, x1: 40, y1: 36 },
        focus: { x: 24, y: 30, radius: 7 },
      },
    });

    expect(plain).not.toContain("data-plot-overlays");
    expect(plain).toContain('data-selected="true"');
    expect(withOverlays).toContain('data-plot-overlays="true"');
    expect(withOverlays).toContain('stroke-dasharray="3 3"');
    expect(withOverlays).toContain(
      '<rect x="10" y="12" width="30" height="24"',
    );
    expect(withOverlays).toContain('<circle cx="24" cy="30" r="7"');
  });

  it("should preserve line discontinuities and rounded padded arcs given compiled marks", () => {
    const lineRows = Object.freeze([
      Object.freeze({ id: "a", x: 0, y: 1, defined: true }),
      Object.freeze({ id: "b", x: 1, y: 2, defined: true }),
      Object.freeze({ id: "gap", x: 2, y: Number.NaN, defined: false }),
      Object.freeze({ id: "c", x: 3, y: 3, defined: true }),
      Object.freeze({ id: "d", x: 4, y: 4, defined: true }),
    ]);
    const lineScene = compilePlotScene({
      rows: lineRows,
      rowKey: "id",
      label: "Discontinuous line",
      descriptors: [
        descriptor("Line", {
          x: "x",
          y: "y",
          defined: (row: (typeof lineRows)[number]) => row.defined,
        }),
      ],
      width: 320,
      height: 180,
    });
    const lineSvg = serializePlotSvg(lineScene);
    const linePathData = /data-mark="line" d="([^"]+)"/.exec(lineSvg)?.[1];

    expect(linePathData?.match(/M/g)).toHaveLength(2);
    expect(lineScene.hits.map(({ key }) => key)).toEqual(["a", "b", "c", "d"]);

    const arcRows = Object.freeze([Object.freeze({ id: "arc", value: 1 })]);
    const arcScene = compilePlotScene({
      rows: arcRows,
      rowKey: "id",
      label: "Rounded arc",
      descriptors: [
        descriptor("Arc", {
          value: "value",
          innerRadius: 20,
          outerRadius: 50,
          startAngle: 0,
          endAngle: Math.PI,
          padAngle: 0.1,
          cornerRadius: 8,
        }),
      ],
      width: 200,
      height: 160,
    });
    const arcSvg = serializePlotSvg(arcScene);
    const arcPathData = /data-mark="arc" d="([^"]+)"/.exec(arcSvg)?.[1];

    expect(arcPathData).toContain("Q");
    expect(arcPathData).not.toContain("NaN");
    expect(arcScene.marks[0]).toMatchObject({ padAngle: 0.1, cornerRadius: 8 });
  });
});

describe("plot data serialization", () => {
  it("should quote structured cells and normalize dates and missing numbers given source rows when exporting CSV", () => {
    const csv = serializePlotData(scene(), {
      rows: "source",
      scope: "all",
      format: "csv",
    });

    expect(csv.startsWith("id,label,value,when,metadata\r\n")).toBe(true);
    expect(csv).toContain('"A, ""quoted""\nnext"');
    expect(csv).toContain("2026-01-01T00:00:00.000Z");
    expect(csv).toContain('"{""ok"":true}"');
    expect(csv).toContain("c,Missing number,,2026-01-03T00:00:00.000Z");
  });

  it("should distinguish all visible and selected scopes given transformed records when exporting JSON", () => {
    const sourceAll = JSON.parse(
      serializePlotData(scene(), {
        rows: "source",
        scope: "all",
        format: "json",
      }),
    ) as readonly Row[];
    const sourceVisible = JSON.parse(
      serializePlotData(scene(), {
        rows: "source",
        scope: "visible",
        format: "json",
      }),
    ) as readonly Row[];
    const sourceSelected = JSON.parse(
      serializePlotData(
        scene(),
        { rows: "source", scope: "selected", format: "json" },
        new Set(["b"]),
      ),
    ) as readonly Row[];

    expect(sourceAll.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(sourceVisible.map(({ id }) => id)).toEqual(["a", "c"]);
    expect(sourceSelected.map(({ id }) => id)).toEqual(["b"]);
    expect(sourceAll[2]?.value).toBeNull();
    expect(sourceAll[0]?.when).toBe("2026-01-01T00:00:00.000Z");
  });

  it("should merge derived channels and normalize non-finite values given transformed rows when exporting JSON", () => {
    const transformed = JSON.parse(
      serializePlotData(scene(), {
        rows: "transformed",
        scope: "visible",
        format: "json",
      }),
    ) as readonly Record<string, unknown>[];

    expect(transformed).toHaveLength(2);
    expect(transformed[0]).toMatchObject({
      id: "a",
      bucket: "one",
      computed: 10,
    });
    expect(transformed[1]).toMatchObject({
      id: "c",
      bucket: "three",
      computed: null,
    });
  });

  it("should emit each transformed identity once given duplicate derived records when exporting", () => {
    const original = scene();
    const duplicate = Object.freeze({
      ...original.transformedRows[0]!,
      values: Object.freeze({ bucket: "replacement", computed: 99 }),
    });
    const duplicatedScene = Object.freeze({
      ...original,
      transformedRows: Object.freeze([...original.transformedRows, duplicate]),
    });

    const transformed = JSON.parse(
      serializePlotData(duplicatedScene, {
        rows: "transformed",
        scope: "all",
        format: "json",
      }),
    ) as readonly Record<string, unknown>[];

    expect(transformed).toHaveLength(3);
    expect(transformed[0]).toMatchObject({
      id: "a",
      bucket: "replacement",
      computed: 99,
    });
  });

  it("should preserve every original row and aggregate source lineage given a histogram when exporting", () => {
    interface HistogramRow {
      readonly id: string;
      readonly value: number | null;
      readonly include: boolean;
    }
    const sourceRows: readonly HistogramRow[] = Object.freeze([
      Object.freeze({ id: "one", value: 1, include: true }),
      Object.freeze({ id: "two", value: 2, include: true }),
      Object.freeze({ id: "missing", value: null, include: true }),
      Object.freeze({ id: "filtered", value: 4, include: false }),
    ]);
    const compiled = compilePlotScene({
      rows: sourceRows,
      rowKey: "id",
      label: "Histogram",
      descriptors: [
        descriptor("Bar", {
          x: bin("value", { thresholds: [0, 10] }),
          y: count(),
          transform: filterRows<HistogramRow>((row) => row.include),
        }),
      ],
      width: 640,
      height: 360,
    });

    const all = JSON.parse(
      serializePlotData(compiled, {
        rows: "source",
        scope: "all",
        format: "json",
      }),
    ) as readonly HistogramRow[];
    const visible = JSON.parse(
      serializePlotData(compiled, {
        rows: "source",
        scope: "visible",
        format: "json",
      }),
    ) as readonly HistogramRow[];
    const aggregateKey = compiled.transformedRows[0]!.key;
    const selectedAggregate = JSON.parse(
      serializePlotData(
        compiled,
        { rows: "source", scope: "selected", format: "json" },
        new Set([aggregateKey]),
      ),
    ) as readonly HistogramRow[];
    const selectedUnused = JSON.parse(
      serializePlotData(
        compiled,
        { rows: "source", scope: "selected", format: "json" },
        new Set(["filtered"]),
      ),
    ) as readonly HistogramRow[];

    expect(all.map(({ id }) => id)).toEqual([
      "one",
      "two",
      "missing",
      "filtered",
    ]);
    expect(visible.map(({ id }) => id)).toEqual(["one", "two"]);
    expect(selectedAggregate.map(({ id }) => id)).toEqual(["one", "two"]);
    expect(selectedUnused.map(({ id }) => id)).toEqual(["filtered"]);
    expect(compiled.transformedRows).toHaveLength(1);
    expect(compiled.transformedRows[0]?.sourceKeys).toEqual(["one", "two"]);
  });

  it("should exclude missing aggregate inputs from visible lineage while retaining source rows", () => {
    const sourceRows = Object.freeze([
      Object.freeze({ id: "a-1", category: "a", amount: 1 }),
      Object.freeze({ id: "a-2", category: "a", amount: 2 }),
      Object.freeze({ id: "a-missing", category: "a", amount: Number.NaN }),
      Object.freeze({ id: "b-missing", category: "b", amount: Number.NaN }),
    ]);
    const compiled = compilePlotScene({
      rows: sourceRows,
      rowKey: "id",
      label: "Aggregate",
      descriptors: [descriptor("Bar", { x: "category", y: sum("amount") })],
      width: 640,
      height: 360,
    });

    const sourceAll = JSON.parse(
      serializePlotData(compiled, {
        rows: "source",
        scope: "all",
        format: "json",
      }),
    ) as readonly { readonly id: string }[];
    const sourceVisible = JSON.parse(
      serializePlotData(compiled, {
        rows: "source",
        scope: "visible",
        format: "json",
      }),
    ) as readonly { readonly id: string }[];
    const transformed = JSON.parse(
      serializePlotData(compiled, {
        rows: "transformed",
        scope: "all",
        format: "json",
      }),
    ) as readonly Record<string, unknown>[];

    expect(sourceAll.map(({ id }) => id)).toEqual([
      "a-1",
      "a-2",
      "a-missing",
      "b-missing",
    ]);
    expect(sourceVisible.map(({ id }) => id)).toEqual(["a-1", "a-2"]);
    expect(transformed).toHaveLength(1);
    expect(transformed[0]).toMatchObject({ id: "a-1", x: "a", y: 3 });
    expect(compiled.omittedRowCount).toBe(2);
  });
});

import { describe, expect, it } from "vite-plus/test";

import { compilePlotScene, type CompilePlotOptions } from "../src/compiler";
import type { PlotDescriptor } from "../src/descriptors";
import {
  bin,
  constant,
  count,
  filterRows,
  movingAverage,
  partition,
  sortRows,
  stack,
  sum,
} from "../src/expressions";
import type { PrimitiveKind } from "../src/model";
import type { SceneAreaMark, SceneLineMark } from "../src/scene-model";

function descriptor(
  kind: PrimitiveKind,
  props: Readonly<Record<string, unknown>> = {},
): PlotDescriptor {
  return Object.freeze({ kind, props: Object.freeze({ ...props }) });
}

function compile<Row extends { readonly id: string }>(
  rows: readonly Row[],
  descriptors: readonly PlotDescriptor[],
  options: Partial<Omit<CompilePlotOptions<Row>, "rows" | "rowKey" | "descriptors">> = {},
) {
  return compilePlotScene({
    rows,
    rowKey: (row) => row.id,
    label: "Test plot",
    descriptors,
    width: 640,
    height: 360,
    ...options,
  });
}

interface MixedRow {
  readonly id: string;
  readonly timestamp: Date;
  readonly latency: number | null;
  readonly p95: number;
  readonly outcome: "ok" | "error";
}

const mixedRows: readonly MixedRow[] = Object.freeze([
  Object.freeze({
    id: "negative-ok",
    timestamp: new Date("2026-07-17T12:00:00Z"),
    latency: -5,
    p95: 10,
    outcome: "ok",
  }),
  Object.freeze({
    id: "negative-error",
    timestamp: new Date("2026-07-17T12:01:00Z"),
    latency: -2,
    p95: 14,
    outcome: "error",
  }),
  Object.freeze({
    id: "positive-ok",
    timestamp: new Date("2026-07-17T12:02:00Z"),
    latency: 2,
    p95: 18,
    outcome: "ok",
  }),
  Object.freeze({
    id: "positive-error",
    timestamp: new Date("2026-07-17T12:03:00Z"),
    latency: 5,
    p95: 22,
    outcome: "error",
  }),
  Object.freeze({
    id: "missing-latency",
    timestamp: new Date("2026-07-17T12:04:00Z"),
    latency: null,
    p95: 20,
    outcome: "error",
  }),
]);

function mixedDescriptors(): readonly PlotDescriptor[] {
  return Object.freeze([
    descriptor("Scale", {
      name: "latency-x",
      channel: "x",
      type: "linear",
      domain: [-5, 5],
    }),
    descriptor("Scale", { name: "time-x", channel: "x", type: "utc" }),
    descriptor("Scale", { name: "count-y", channel: "y", type: "linear" }),
    descriptor("Scale", {
      name: "p95-y",
      channel: "y",
      type: "symlog",
      constant: 5,
    }),
    descriptor("Scale", {
      name: "outcome-color",
      channel: "color",
      type: "ordinal-color",
      domain: ["ok", "error"],
      range: ["#059669", "#dc2626"],
    }),
    descriptor("Bar", {
      x: bin("latency", { thresholds: [0] }),
      y: count(),
      fill: "outcome",
      stack: "outcome",
      xScale: "latency-x",
      yScale: "count-y",
      colorScale: "outcome-color",
    }),
    descriptor("Line", {
      x: "timestamp",
      y: movingAverage("p95", { window: 2 }),
      xScale: "time-x",
      yScale: "p95-y",
      stroke: constant("#7c3aed"),
      curve: "monotone",
    }),
    descriptor("Point", {
      x: "timestamp",
      y: "p95",
      xScale: "time-x",
      yScale: "p95-y",
      fill: constant("#7c3aed"),
    }),
    descriptor("Axis", {
      scale: "latency-x",
      orient: "bottom",
      label: "Latency",
    }),
    descriptor("Axis", { scale: "time-x", orient: "top", label: "Time" }),
    descriptor("Axis", { scale: "count-y", orient: "left", label: "Count" }),
    descriptor("Axis", { scale: "p95-y", orient: "right", label: "P95" }),
    descriptor("Grid", { scale: "p95-y", axis: "y" }),
    descriptor("Legend", { scale: "outcome-color", label: "Outcome" }),
    descriptor("Crosshair", { axes: "xy" }),
    descriptor("Zoom", { axes: "xy", min: 1, max: 8 }),
    descriptor("Brush", { axis: "x", modifier: "shift" }),
  ]);
}

describe("mixed plot compilation", () => {
  it("should compile a stacked signed histogram with trend marks given named scales when building a scene", () => {
    const scene = compile(mixedRows, mixedDescriptors(), { label: "Latency" });

    expect(Object.keys(scene.scales).sort()).toEqual(
      ["count-y", "latency-x", "outcome-color", "p95-y", "time-x"].sort(),
    );
    expect(scene.scales["latency-x"]?.type).toBe("linear");
    expect(scene.scales["latency-x"]?.domain).toEqual([-5, 5]);
    expect(scene.scales["time-x"]?.type).toBe("utc");
    expect(scene.scales["p95-y"]?.type).toBe("symlog");
    expect(scene.axes.map(({ scale, orientation }) => [scale, orientation])).toEqual([
      ["latency-x", "bottom"],
      ["time-x", "top"],
      ["count-y", "left"],
      ["p95-y", "right"],
    ]);
    expect(scene.plotArea).toMatchObject({ x: 56, y: 44 });
    expect(scene.width - (scene.plotArea.x + scene.plotArea.width)).toBe(56);
    expect(
      scene.axes.find(({ scale }) => scale === "time-x")?.ticks.map(({ label }) => label),
    ).toEqual(expect.arrayContaining(["12:00", "12:04"]));
    expect(scene.marks.filter(({ kind }) => kind === "bar")).toHaveLength(4);
    expect(scene.marks.filter(({ kind }) => kind === "line")).toHaveLength(1);
    expect(scene.marks.filter(({ kind }) => kind === "point")).toHaveLength(5);
    expect(scene.legends[0]?.items.map(({ value }) => value)).toEqual([
      "string:ok",
      "string:error",
    ]);
    expect(scene.interactions).toMatchObject({
      tooltip: true,
      crosshair: "xy",
      zoom: { axes: "xy", min: 1, max: 8 },
      brush: { axis: "x", modifier: "shift" },
    });
  });

  it("should report a missing binned measurement given a mixed plot when building its summary", () => {
    const scene = compile(mixedRows, mixedDescriptors(), { label: "Latency" });

    expect(scene.omittedRowCount).toBe(1);
    expect(scene.diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing-channel", count: 1 }),
    );
    expect(scene.summary).toContain("1 row was omitted");
  });
});

describe("scale and diagnostic defaults", () => {
  it("should infer band and signed linear scales with default axes given missing rows when compiling bars", () => {
    const rows = Object.freeze([
      Object.freeze({ id: "negative", category: "a", value: -4 }),
      Object.freeze({ id: "positive", category: "b", value: 8 }),
      Object.freeze({ id: "null", category: "c", value: null }),
      Object.freeze({ id: "nan", category: "d", value: Number.NaN }),
    ]);
    const scene = compile(rows, [descriptor("Bar", { x: "category", y: "value" })], {
      label: "Signed values",
    });

    expect(scene.scales.x?.type).toBe("band");
    expect(scene.scales.x?.domain).toEqual(["a", "b"]);
    expect(scene.scales.y?.type).toBe("linear");
    expect(scene.scales.y?.domain).toEqual([-4, 8]);
    expect(scene.axes.map(({ scale, orientation }) => [scale, orientation])).toEqual([
      ["x", "bottom"],
      ["y", "left"],
    ]);
    expect(scene.marks).toHaveLength(2);
    expect(scene.omittedRowCount).toBe(2);
    expect(scene.summary).toContain("2 rows were omitted");
    expect(scene.interactions.tooltip).toBe(true);
  });

  it("should infer default axes from named scale channels given no explicit axes when compiling", () => {
    const rows = Object.freeze([
      { id: "first", timestamp: new Date("2026-07-17T12:00:00Z"), value: 4 },
      { id: "second", timestamp: new Date("2026-07-17T12:01:00Z"), value: 8 },
    ]);
    const scene = compile(rows, [
      descriptor("Scale", { name: "time", channel: "x", type: "utc" }),
      descriptor("Scale", { name: "value", channel: "y", type: "linear" }),
      descriptor("Line", {
        x: "timestamp",
        y: "value",
        xScale: "time",
        yScale: "value",
      }),
      descriptor("Zoom", { axes: "xy" }),
    ]);

    expect(scene.axes.map(({ scale, orientation }) => [scale, orientation])).toEqual([
      ["time", "bottom"],
      ["value", "left"],
    ]);
    expect(scene.interactions.zoom?.axes).toBe("xy");
  });

  it("should resolve shared-x tooltip and toggle selection given explicit interaction descriptors", () => {
    const rows = Object.freeze([{ id: "a", x: 1, y: 2 }]);
    const scene = compile(rows, [
      descriptor("Point", { x: "x", y: "y" }),
      descriptor("Tooltip", { mode: "x", channels: ["x", "y"] }),
      descriptor("Select", { mode: "toggle" }),
    ]);

    expect(scene.interactions.tooltipMode).toBe("x");
    expect(scene.interactions.tooltipChannels).toEqual(["x", "y"]);
    expect(scene.interactions.select).toEqual({ mode: "toggle" });
    expect(Object.isFrozen(scene.interactions.select)).toBe(true);
  });

  it("should reject invalid tooltip and select modes given malformed descriptors", () => {
    const rows = Object.freeze([{ id: "a", x: 1, y: 2 }]);
    expect(() =>
      compile(rows, [descriptor("Point", { x: "x", y: "y" }), descriptor("Tooltip", { mode: "near" })]),
    ).toThrow(/Invalid Tooltip mode/);
    expect(() =>
      compile(rows, [descriptor("Point", { x: "x", y: "y" }), descriptor("Select", { mode: "many" })]),
    ).toThrow(/Invalid Select mode/);
  });

  it("should use a band height given a Rect with one categorical y bound when compiling", () => {
    const rows = Object.freeze([
      { id: "api", lane: "API", start: 0, end: 42 },
      { id: "data", lane: "Data", start: 42, end: 100 },
    ]);
    const scene = compile(rows, [
      descriptor("Scale", {
        name: "elapsed",
        channel: "x",
        type: "linear",
        domain: [0, 100],
      }),
      descriptor("Rect", {
        x: "start",
        x2: "end",
        y: "lane",
        xScale: "elapsed",
      }),
    ]);
    const rects = scene.marks.filter((mark) => mark.kind === "rect");

    expect(scene.scales.y?.type).toBe("band");
    expect(rects).toHaveLength(2);
    expect(rects.every((rect) => rect.kind === "rect" && rect.height > 1)).toBe(true);
    expect(scene.omittedRowCount).toBe(0);
  });

  it("should diagnose invalid logarithmic and non-finite values given an explicit log scale when compiling", () => {
    const rows = Object.freeze([
      { id: "ten", category: "a", value: 10 },
      { id: "zero", category: "b", value: 0 },
      { id: "negative", category: "c", value: -2 },
      { id: "hundred", category: "d", value: 100 },
      { id: "nan", category: "e", value: Number.NaN },
      { id: "infinite", category: "f", value: Number.POSITIVE_INFINITY },
    ]);
    const scene = compile(
      rows,
      [
        descriptor("Scale", { name: "log-y", channel: "y", type: "log" }),
        descriptor("Point", { x: "category", y: "value", yScale: "log-y" }),
      ],
      { label: "Log values" },
    );

    expect(scene.marks.filter(({ kind }) => kind === "point")).toHaveLength(2);
    expect(scene.scales["log-y"]?.omittedValueCount).toBe(2);
    expect(scene.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-log", count: 2 }),
    );
    expect(scene.diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing-channel", count: 2 }),
    );
    expect(scene.omittedRowCount).toBe(4);
    expect(scene.summary).toContain("4 rows were omitted");
  });

  it("should count an invalid log row once given multiple marks sharing its scale when compiling", () => {
    const rows = Object.freeze([
      { id: "invalid", category: "a", value: 0 },
      { id: "valid", category: "b", value: 10 },
    ]);
    const scene = compile(rows, [
      descriptor("Scale", { name: "log-y", channel: "y", type: "log" }),
      descriptor("Line", { x: "category", y: "value", yScale: "log-y" }),
      descriptor("Point", { x: "category", y: "value", yScale: "log-y" }),
    ]);

    expect(scene.scales["log-y"]?.omittedValueCount).toBe(2);
    expect(scene.omittedRowCount).toBe(1);
    expect(scene.summary).toContain("1 row was omitted");
  });

  it("should reject duplicate source identities given stable row keys when compiling", () => {
    expect(() =>
      compile(
        [
          { id: "same", category: "a", value: 1 },
          { id: "same", category: "b", value: 2 },
        ],
        [descriptor("Bar", { x: "category", y: "value" })],
      ),
    ).toThrow(/Duplicate plot row key same/);
  });
});

describe("aggregate and stack expressions", () => {
  it("should honor zero offset and descending order given a stack expression when compiling bars", () => {
    const rows = Object.freeze([
      { id: "negative", category: "same", series: "negative", value: -2 },
      { id: "positive", category: "same", series: "positive", value: 5 },
    ]);
    const scene = compile(rows, [
      descriptor("Bar", {
        x: "category",
        y: stack("value", { offset: "zero", order: "descending" }),
        fill: "series",
      }),
    ]);
    const positive = scene.marks.find((mark) => mark.kind === "bar" && mark.key === "positive");

    expect(scene.scales.y?.domain).toEqual([0, 5]);
    expect(positive?.kind).toBe("bar");
    if (positive?.kind === "bar") expect(positive.y).toBeCloseTo(scene.plotArea.y);
  });

  it("should omit every contributing row given an all-missing sum when compiling an aggregate", () => {
    const rows = Object.freeze([
      { id: "missing", category: "same", value: null },
      { id: "not-finite", category: "same", value: Number.NaN },
    ]);
    const scene = compile(rows, [descriptor("Bar", { x: "category", y: sum("value") })]);

    expect(scene.marks).toHaveLength(0);
    expect(scene.transformedRows).toHaveLength(0);
    expect(scene.omittedRowCount).toBe(2);
  });
});

describe("partition transform sequencing", () => {
  it("should filter and sort rows before partitioning given preceding transforms when compiling Rect", () => {
    interface PartitionRow {
      readonly id: string;
      readonly parent: string | null;
      readonly value: number;
      readonly visible: boolean;
    }
    const rows: readonly PartitionRow[] = Object.freeze([
      { id: "root", parent: null, value: 0, visible: true },
      { id: "small", parent: "root", value: 1, visible: true },
      { id: "large", parent: "root", value: 3, visible: true },
      { id: "hidden", parent: "root", value: 8, visible: false },
    ]);
    const scene = compile(rows, [
      descriptor("Rect", {
        transform: [
          filterRows<PartitionRow>((row) => row.visible),
          sortRows<PartitionRow>({ by: "value", direction: "descending" }),
          partition<PartitionRow>({
            id: "id",
            parentId: "parent",
            value: "value",
          }),
        ],
      }),
    ]);
    const large = scene.marks.find((mark) => mark.kind === "rect" && mark.key === "large");
    const small = scene.marks.find((mark) => mark.kind === "rect" && mark.key === "small");

    expect(scene.marks.some((mark) => mark.key === "hidden")).toBe(false);
    expect(large?.kind).toBe("rect");
    expect(small?.kind).toBe("rect");
    if (large?.kind === "rect" && small?.kind === "rect") {
      expect(large.x).toBeLessThan(small.x);
      expect(large.width).toBeGreaterThan(small.width);
    }
  });
});

interface FamilyRow {
  readonly id: string;
  readonly category: string;
  readonly lane: string;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly value: number;
  readonly radius: number;
  readonly label: string;
}

const familyRow: FamilyRow = Object.freeze({
  id: "only",
  category: "alpha",
  lane: "primary",
  x0: 2,
  x1: 8,
  y0: 1,
  y1: 7,
  value: 6,
  radius: 4,
  label: "Only row",
});

function familyDescriptors(): readonly PlotDescriptor[] {
  const data = Object.freeze([familyRow]);
  return Object.freeze([
    descriptor("Scale", {
      name: "category-x",
      channel: "x",
      type: "band",
      domain: ["alpha"],
    }),
    descriptor("Scale", {
      name: "lane-y",
      channel: "y",
      type: "band",
      domain: ["primary"],
    }),
    descriptor("Scale", {
      name: "numeric-x",
      channel: "x",
      type: "linear",
      domain: [0, 10],
    }),
    descriptor("Scale", {
      name: "numeric-y",
      channel: "y",
      type: "linear",
      domain: [0, 10],
    }),
    descriptor("Scale", {
      name: "heat",
      channel: "color",
      type: "continuous-color",
      domain: [0, 10],
      range: ["#eff6ff", "#2563eb"],
    }),
    descriptor("Bar", {
      data,
      x: "category",
      y: "value",
      xScale: "category-x",
      yScale: "numeric-y",
    }),
    descriptor("Line", {
      data,
      x: "x0",
      y: "value",
      xScale: "numeric-x",
      yScale: "numeric-y",
      stroke: constant("#2563eb"),
    }),
    descriptor("Area", {
      data,
      x: "x0",
      y: "y1",
      y2: "y0",
      xScale: "numeric-x",
      yScale: "numeric-y",
    }),
    descriptor("Point", {
      data,
      x: "x0",
      y: "value",
      r: "radius",
      xScale: "numeric-x",
      yScale: "numeric-y",
      shape: "diamond",
    }),
    descriptor("Arc", {
      data,
      value: "value",
      innerRadius: 0.4,
      padAngle: 0,
    }),
    descriptor("Cell", {
      data,
      x: "category",
      y: "lane",
      value: "value",
      xScale: "category-x",
      yScale: "lane-y",
      colorScale: "heat",
    }),
    descriptor("Rect", {
      data,
      x: "x0",
      x2: "x1",
      y: "y0",
      y2: "y1",
      xScale: "numeric-x",
      yScale: "numeric-y",
    }),
    descriptor("Rule", {
      data,
      x: "x0",
      x2: "x1",
      y: "value",
      xScale: "numeric-x",
      yScale: "numeric-y",
    }),
    descriptor("Text", {
      data,
      x: "x0",
      y: "value",
      text: "label",
      xScale: "numeric-x",
      yScale: "numeric-y",
    }),
    descriptor("Legend", { scale: "heat", label: "Value" }),
  ]);
}

describe("mark family compilation", () => {
  it("should compile every primitive mark exactly once given valid channels when building a scene", () => {
    const scene = compile(Object.freeze([familyRow]), familyDescriptors());

    expect(scene.marks.map(({ kind }) => kind).sort()).toEqual(
      ["bar", "line", "area", "point", "arc", "cell", "rect", "rule", "text"].sort(),
    );
    expect(scene.hits).toHaveLength(9);
    expect(scene.legends[0]).toMatchObject({ scale: "heat", label: "Value" });
  });

  it("should produce a deeply immutable scene given every mark family when compilation completes", () => {
    const scene = compile(Object.freeze([familyRow]), familyDescriptors());
    const line = scene.marks.find((mark): mark is SceneLineMark<FamilyRow> => mark.kind === "line");
    const area = scene.marks.find((mark): mark is SceneAreaMark<FamilyRow> => mark.kind === "area");

    expect(Object.isFrozen(scene)).toBe(true);
    expect(Object.isFrozen(scene.plotArea)).toBe(true);
    expect(Object.isFrozen(scene.scales)).toBe(true);
    expect(Object.values(scene.scales).every(Object.isFrozen)).toBe(true);
    expect(scene.axes.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(scene.marks)).toBe(true);
    expect(scene.marks.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(scene.hits)).toBe(true);
    expect(scene.hits.every((hit) => Object.isFrozen(hit) && Object.isFrozen(hit.shape))).toBe(
      true,
    );
    expect(Object.isFrozen(scene.legends)).toBe(true);
    expect(Object.isFrozen(scene.interactions)).toBe(true);
    expect(Object.isFrozen(scene.sourceRows)).toBe(true);
    expect(Object.isFrozen(scene.sourceRowRecords)).toBe(true);
    expect(scene.sourceRowRecords.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(scene.transformedRows)).toBe(true);
    expect(scene.transformedRows.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(line?.points)).toBe(true);
    expect(line?.points.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(area?.points)).toBe(true);
    expect(Object.isFrozen(area?.baseline)).toBe(true);
    expect(area?.points.every(Object.isFrozen)).toBe(true);
    expect(area?.baseline.every(Object.isFrozen)).toBe(true);
  });
});

describe("bounded marks", () => {
  it("should clamp an overflowing progress value given bounded horizontal Bar props when compiling", () => {
    const rows = Object.freeze([{ id: "progress", label: "Migration", value: 150 }]);
    const scene = compile(rows, [
      descriptor("Bar", {
        x: "label",
        y: "value",
        orientation: "horizontal",
        min: 0,
        max: 100,
      }),
    ]);
    const bar = scene.marks.find((mark) => mark.kind === "bar");

    expect(scene.scales.x?.domain).toEqual([0, 100]);
    expect(bar?.kind).toBe("bar");
    if (bar?.kind === "bar") {
      expect(bar.x + bar.width).toBeCloseTo(scene.plotArea.x + scene.plotArea.width);
    }
  });

  it("should clamp an overflowing gauge value given bounded Arc props when compiling", () => {
    const rows = Object.freeze([{ id: "gauge", value: 150 }]);
    const scene = compile(rows, [
      descriptor("Arc", {
        value: "value",
        min: 0,
        max: 100,
        startAngle: -Math.PI,
        endAngle: 0,
        padAngle: 0,
      }),
    ]);
    const arc = scene.marks.find((mark) => mark.kind === "arc");

    expect(arc?.kind).toBe("arc");
    if (arc?.kind === "arc") {
      expect(arc.startAngle).toBeCloseTo(-Math.PI);
      expect(arc.endAngle).toBeCloseTo(0);
    }
  });

  it("should render from a signed minimum given a negative bounded Arc value when compiling", () => {
    const rows = Object.freeze([{ id: "gauge", value: -25 }]);
    const scene = compile(rows, [
      descriptor("Arc", {
        value: "value",
        min: -100,
        max: 100,
        startAngle: 0,
        endAngle: Math.PI * 2,
        padAngle: 0,
      }),
    ]);
    const arc = scene.marks.find((mark) => mark.kind === "arc");

    expect(arc?.kind).toBe("arc");
    if (arc?.kind === "arc") {
      expect(arc.startAngle).toBeCloseTo(0);
      expect(arc.endAngle).toBeCloseTo(Math.PI * 0.75);
    }
    expect(scene.omittedRowCount).toBe(0);
  });

  it("should omit negative values given an ordinary pie Arc when compiling", () => {
    const rows = Object.freeze([
      { id: "negative", value: -1 },
      { id: "positive", value: 3 },
    ]);
    const scene = compile(rows, [descriptor("Arc", { value: "value", padAngle: 0 })]);

    expect(scene.marks.filter((mark) => mark.kind === "arc")).toHaveLength(1);
    expect(scene.marks[0]?.key).toBe("positive");
    expect(scene.omittedRowCount).toBe(1);
  });

  it("should apply directional padding and retain rounded geometry given a reverse Arc", () => {
    const rows = Object.freeze([{ id: "gauge", value: 100 }]);
    const scene = compile(rows, [
      descriptor("Arc", {
        value: "value",
        min: 0,
        max: 100,
        startAngle: 0,
        endAngle: -Math.PI,
        padAngle: 0.2,
        cornerRadius: 9,
      }),
    ]);
    const arc = scene.marks.find((mark) => mark.kind === "arc");

    expect(arc?.kind).toBe("arc");
    if (arc?.kind === "arc") {
      expect(arc.startAngle).toBeCloseTo(-0.1);
      expect(arc.endAngle).toBeCloseTo(-Math.PI + 0.1);
      expect(arc.endAngle).toBeLessThan(arc.startAngle);
      expect(arc.padAngle).toBeCloseTo(0.2);
      expect(arc.cornerRadius).toBe(9);
      expect(scene.hits[0]?.shape).toMatchObject({
        kind: "arc",
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
      });
    }
  });
});

describe("large scene reduction", () => {
  it("should downsample a dense line to a pixel envelope given many rows when compiling", () => {
    const rows = Object.freeze(
      Array.from({ length: 20_000 }, (_, index) => ({
        id: String(index),
        x: index,
        y: index === 10_000 ? Number.NaN : Math.sin(index / 17),
      })),
    );
    const scene = compile(rows, [descriptor("Line", { x: "x", y: "y" })], {
      width: 200,
      height: 120,
    });
    const line = scene.marks.find(
      (mark): mark is SceneLineMark<(typeof rows)[number]> => mark.kind === "line",
    );

    expect(line).toBeDefined();
    expect(line?.points.length).toBeLessThan(rows.length);
    expect(line?.points.length).toBeLessThanOrEqual(scene.plotArea.width * 4 + 4);
    expect(scene.hits).toHaveLength(line?.points.length ?? 0);
  });

  it("should preserve defined gaps given dense runs when downsampling a line", () => {
    const rows = Object.freeze(
      Array.from({ length: 20_001 }, (_, index) => ({
        id: String(index),
        x: index,
        y: Math.sin(index / 17),
        visible: index !== 10_000,
      })),
    );
    const scene = compile(
      rows,
      [
        descriptor("Line", {
          x: "x",
          y: "y",
          defined: (row: (typeof rows)[number]) => row.visible,
        }),
      ],
      { width: 200, height: 120 },
    );
    const line = scene.marks.find(
      (mark): mark is SceneLineMark<(typeof rows)[number]> => mark.kind === "line",
    );

    expect(line?.segments).toHaveLength(2);
    expect(line?.segments.map((segment) => segment.length).every((length) => length > 0)).toBe(
      true,
    );
    expect(line?.points).toHaveLength(
      (line?.segments[0]?.length ?? 0) + (line?.segments[1]?.length ?? 0),
    );
    expect(line?.points.some(({ key }) => key === "10000")).toBe(false);
    expect(scene.hits).toHaveLength(line?.points.length ?? 0);
    expect(Object.isFrozen(line?.segments)).toBe(true);
    expect(line?.segments.every(Object.isFrozen)).toBe(true);
  });

  it("should cull bars outside the current view given a narrow domain when compiling", () => {
    const rows = Object.freeze(
      Array.from({ length: 1_000 }, (_, index) => ({
        id: String(index),
        x: index,
        y: 1,
      })),
    );
    const scene = compile(rows, [descriptor("Bar", { x: "x", y: "y" })], {
      width: 200,
      height: 120,
      view: { x: [0, 9] },
    });
    const bars = scene.marks.filter(({ kind }) => kind === "bar");

    expect(bars.length).toBeGreaterThan(0);
    expect(bars.length).toBeLessThan(20);
    expect(
      bars.every((bar) => bar.kind !== "bar" || bar.x <= scene.plotArea.x + scene.plotArea.width),
    ).toBe(true);
  });
});

describe("runtime contract hardening", () => {
  it("should align horizontal bars to the start of their categorical band when compiling", () => {
    const scene = compile(
      Object.freeze([
        { id: "first", category: "a", value: 4 },
        { id: "second", category: "b", value: 8 },
      ]),
      [
        descriptor("Scale", { name: "amount", channel: "x", type: "linear", domain: [0, 10] }),
        descriptor("Bar", {
          x: "category",
          y: "value",
          orientation: "horizontal",
          xScale: "amount",
        }),
      ],
    );
    const scale = scene.scales.y;
    const bar = scene.marks.find((mark) => mark.kind === "bar" && mark.key === "first");

    expect(scale?.type).toBe("band");
    expect(bar?.kind).toBe("bar");
    if (bar?.kind === "bar") {
      expect(bar.y).toBeCloseTo(Number(scale?.map("a")));
      expect(bar.height).toBeCloseTo(scale?.bandwidth ?? 0);
    }
  });

  it("should span categorical rect bounds exactly through the ending band when compiling", () => {
    const scene = compile(Object.freeze([{ id: "range", start: "a", end: "b", lane: 1 }]), [
      descriptor("Scale", {
        name: "category",
        channel: "x",
        type: "band",
        domain: ["a", "b", "c"],
      }),
      descriptor("Rect", { x: "start", x2: "end", y: "lane", xScale: "category" }),
    ]);
    const scale = scene.scales.category;
    const rect = scene.marks.find((mark) => mark.kind === "rect");
    const start = Number(scale?.map("a"));
    const end = Number(scale?.map("b")) + (scale?.bandwidth ?? 0);

    expect(rect?.kind).toBe("rect");
    if (rect?.kind === "rect") {
      expect(rect.x).toBeCloseTo(start);
      expect(rect.width).toBeCloseTo(end - start);
    }
  });

  it("should use one typed identity for boolean colors and their legend entries when compiling", () => {
    const scene = compile(
      Object.freeze([
        { id: "enabled", x: 1, y: 1, enabled: true },
        { id: "disabled", x: 2, y: 2, enabled: false },
      ]),
      [
        descriptor("Scale", {
          name: "status",
          channel: "color",
          type: "ordinal-color",
          domain: [true, false],
          range: ["#00aa00", "#aa0000"],
        }),
        descriptor("Point", { x: "x", y: "y", fill: "enabled", colorScale: "status" }),
        descriptor("Legend", { scale: "status", interactive: true }),
      ],
    );
    const enabled = scene.marks.find((mark) => mark.key === "enabled");
    const disabled = scene.marks.find((mark) => mark.key === "disabled");

    expect(enabled?.fill).toBe(scene.scales.status?.map(true));
    expect(disabled?.fill).toBe(scene.scales.status?.map(false));
    expect(scene.legends[0]?.items.map(({ label }) => label)).toEqual(["true", "false"]);
    expect(new Set(scene.legends[0]?.items.map(({ value }) => value)).size).toBe(2);
  });

  it("should retain a data-driven stroke scale given a constant fill when compiling", () => {
    const scene = compile(
      Object.freeze([
        { id: "api", x: 1, y: 1, series: "api" },
        { id: "worker", x: 2, y: 2, series: "worker" },
      ]),
      [
        descriptor("Point", {
          x: "x",
          y: "y",
          fill: constant("#ffffff"),
          stroke: "series",
        }),
      ],
    );

    expect(scene.scales.color?.type).toBe("ordinal-color");
    expect(scene.marks.map(({ stroke }) => stroke)).toEqual([
      scene.scales.color?.map("api"),
      scene.scales.color?.map("worker"),
    ]);
  });

  it("should keep legends passive unless interaction is explicitly requested when compiling", () => {
    const scene = compile(Object.freeze([{ id: "point", x: 1, y: 1, series: "api" }]), [
      descriptor("Point", { x: "x", y: "y", fill: "series" }),
      descriptor("Legend"),
    ]);

    expect(scene.legends[0]?.interactive).toBe(false);
  });

  it("should keep delimiter-bearing aggregate groups distinct when compiling", () => {
    const scene = compile(
      Object.freeze([
        { id: "first", category: "a", series: "b:c" },
        { id: "second", category: "a:b", series: "c" },
      ]),
      [descriptor("Bar", { x: "category", y: count(), fill: "series" })],
    );

    expect(scene.marks.filter(({ kind }) => kind === "bar")).toHaveLength(2);
    expect(scene.transformedRows).toHaveLength(2);
  });

  it("should reject partition transforms outside the final Rect transform position when compiling", () => {
    const rows = Object.freeze([{ id: "root", parent: null, value: 1 }]);
    const partitionTransform = partition<(typeof rows)[number]>({
      id: "id",
      parentId: "parent",
      value: "value",
    });

    expect(() =>
      compile(rows, [
        descriptor("Rect", {
          transform: [partitionTransform, filterRows(() => true)],
        }),
      ]),
    ).toThrow(/partition transform must be last/i);
    expect(() =>
      compile(rows, [
        descriptor("Point", { x: "value", y: "value", transform: partitionTransform }),
      ]),
    ).toThrow(/only Rect/i);
  });

  it("should omit text marks with missing text channels when compiling", () => {
    const scene = compile(Object.freeze([{ id: "missing", x: 1, y: 1, label: null }]), [
      descriptor("Text", { x: "x", y: "y", text: "label" }),
    ]);

    expect(scene.marks).toHaveLength(0);
    expect(scene.omittedRowCount).toBe(1);
  });

  it("should reject ambiguous multi-row bounded arcs when compiling", () => {
    expect(() =>
      compile(
        Object.freeze([
          { id: "first", value: 60 },
          { id: "second", value: 60 },
        ]),
        [descriptor("Arc", { value: "value", min: 0, max: 100 })],
      ),
    ).toThrow(/bounded Arc requires exactly one/i);
  });

  it("should reject invalid descriptor references and zoom extents when compiling", () => {
    const rows = Object.freeze([{ id: "point", x: 1, y: 1 }]);

    expect(() =>
      compile(rows, [
        descriptor("Point", { x: "x", y: "y" }),
        descriptor("Axis", { scale: "missing" }),
      ]),
    ).toThrow(/unknown scale missing/i);
    expect(() =>
      compile(rows, [
        descriptor("Scale", { name: "x", channel: "x" }),
        descriptor("Scale", { name: "x", channel: "x" }),
        descriptor("Point", { x: "x", y: "y" }),
      ]),
    ).toThrow(/duplicate scale x/i);
    expect(() =>
      compile(rows, [
        descriptor("Point", { x: "x", y: "y" }),
        descriptor("Zoom", { min: 8, max: 2 }),
      ]),
    ).toThrow(/maximum.*minimum/i);
  });

  it("should preserve named coordinate directions and reject incompatible scales when compiling", () => {
    const rows = Object.freeze([{ id: "point", time: 1, latency: 4, status: "ok" }]);
    const scene = compile(rows, [
      descriptor("Scale", { name: "time", channel: "x", type: "linear" }),
      descriptor("Scale", { name: "latency", channel: "y", type: "linear" }),
      descriptor("Point", { x: "time", y: "latency", xScale: "time", yScale: "latency" }),
      descriptor("Axis", { scale: "latency" }),
      descriptor("Grid", { scale: "time" }),
    ]);

    expect(scene.axes[0]).toMatchObject({ scale: "latency", orientation: "left" });
    expect(scene.grids[0]).toMatchObject({ scale: "time", axis: "x" });
    expect(() =>
      compile(rows, [
        descriptor("Scale", { name: "status", channel: "color", type: "linear" }),
        descriptor("Point", {
          x: "time",
          y: "latency",
          fill: "status",
          colorScale: "status",
        }),
      ]),
    ).toThrow(/incompatible.*color channel/i);
  });

  it("should remove invalid samples before stacking and keep typed series distinct when compiling", () => {
    const stacked = compile(
      Object.freeze([
        { id: "missing", category: "a", value: Number.NaN, series: "missing" },
        { id: "string", category: "a", value: 2, series: "1" as string | number },
        { id: "number", category: "a", value: 3, series: 1 as string | number },
      ]),
      [descriptor("Bar", { x: "category", y: "value", fill: "series", stack: "series" })],
    );

    expect(stacked.marks.filter(({ kind }) => kind === "bar")).toHaveLength(2);
    expect(stacked.scales.y?.domain).toEqual([0, 5]);
    expect(stacked.omittedRowCount).toBe(1);
    expect(new Set(stacked.marks.map(({ series }) => series))).toEqual(
      new Set(["string:1", "number:1"]),
    );
    expect(new Set(stacked.legends[0]?.items.map(({ value }) => value))).toEqual(
      new Set(["string:1", "number:1"]),
    );
  });

  it("should retain viewport crossings and paired area samples given dense scenes when compiling", () => {
    const crossing = compile(
      Object.freeze([
        { id: "left", x: 0, y: 1 },
        { id: "right", x: 10, y: 2 },
      ]),
      [descriptor("Line", { x: "x", y: "y" })],
      { view: { x: [4, 6] } },
    );
    const line = crossing.marks.find((mark) => mark.kind === "line");
    expect(line?.kind).toBe("line");
    if (line?.kind === "line") {
      expect(line.points.map(({ x }) => x)).toEqual([
        crossing.plotArea.x,
        crossing.plotArea.x + crossing.plotArea.width,
      ]);
    }

    const denseRows = Object.freeze(
      Array.from({ length: 5_000 }, (_, index) => ({
        id: `area-${index}`,
        x: index,
        y: Math.sin(index / 7) * 10 + 20,
        low: Math.cos(index / 11) * 2,
      })),
    );
    const dense = compile(denseRows, [descriptor("Area", { x: "x", y: "y", y2: "low" })], {
      width: 180,
    });
    const area = dense.marks.find((mark) => mark.kind === "area");
    expect(area?.kind).toBe("area");
    if (area?.kind === "area") {
      expect(area.points.length).toBeLessThan(denseRows.length);
      expect(area.baseline).toHaveLength(area.points.length);
      expect(area.baseline.map(({ x }) => x)).toEqual(area.points.map(({ x }) => x));
    }
  });
});

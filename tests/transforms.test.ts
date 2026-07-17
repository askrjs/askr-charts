import { describe, expect, it } from "vite-plus/test";

import { filterRows, movingAverage, sortRows } from "../src/expressions";
import {
  aggregateBy,
  applyRowTransforms,
  createBins,
  evaluateChannel,
  linearRegression,
  movingWindowValues,
  partitionRows,
  stackValues,
} from "../src/transforms";

describe("bins and aggregates", () => {
  it("should preserve signed observations and omit missing values given explicit bins when grouping", () => {
    const values = [-5, null, -1, Number.NaN, 0, 2, 5, undefined];

    const bins = createBins(values, { domain: [-5, 5], thresholds: [0] });

    expect(bins).toEqual([
      { x0: -5, x1: 0, indices: [0, 2] },
      { x0: 0, x1: 5, indices: [4, 5, 6] },
    ]);
    expect(Object.isFrozen(bins)).toBe(true);
    expect(Object.isFrozen(bins[0]?.indices)).toBe(true);
    expect(createBins(values, { domain: [-5, 5], thresholds: [0, 0] })).toEqual(bins);
  });

  it("should use calendar timestamps and interval boundaries given dates when binning", () => {
    const values = [new Date(0), new Date(1_000), new Date(Number.NaN), new Date(2_000)];

    const bins = createBins(values, {
      domain: [new Date(0), new Date(2_000)],
      interval: 1_000,
    });

    expect(bins).toEqual([
      { x0: 0, x1: 1_000, indices: [0] },
      { x0: 1_000, x1: 2_000, indices: [1, 3] },
    ]);
  });

  it("should reject ambiguous or malformed options given runtime bin configuration", () => {
    expect(() => createBins([1, 2], { interval: 1, thresholds: 2 })).toThrow(TypeError);
    expect(() => createBins([1, 2], { interval: 0 })).toThrow(RangeError);
    expect(() => createBins([1, 2], { thresholds: Number.NaN })).toThrow(RangeError);
    expect(() => createBins([1, 2], { thresholds: [Number.POSITIVE_INFINITY] })).toThrow(TypeError);
    expect(() => createBins([1, 2], { domain: [0, Number.NaN] })).toThrow(TypeError);
    expect(() =>
      createBins([1, 2], { domain: [0] as unknown as readonly [number, number] }),
    ).toThrow(/exactly two finite values/i);
  });

  it("should count rows but omit missing numeric inputs given grouped aggregates when reducing", () => {
    const values = [5, null, -2, Number.NaN, 7, undefined];
    const keys = ["a", "a", "a", "b", "b", "c"];

    expect([...aggregateBy(values, keys, "count")]).toEqual([
      ["a", 3],
      ["b", 2],
      ["c", 1],
    ]);
    expect([...aggregateBy(values, keys, "sum")]).toEqual([
      ["a", 3],
      ["b", 7],
    ]);
    expect([...aggregateBy(values, keys, "mean")]).toEqual([
      ["a", 1.5],
      ["b", 7],
    ]);
    expect(() => aggregateBy(values, keys, "invalid" as "sum")).toThrow(TypeError);
  });
});

describe("stacking", () => {
  const data = Object.freeze([
    { key: "x", series: "a", value: 6, index: 0 },
    { key: "x", series: "b", value: 4, index: 1 },
    { key: "x", series: "c", value: -2, index: 2 },
    { key: "x", series: "d", value: -8, index: 3 },
  ]);

  it("should accumulate away from zero given signed values when using a diverging stack", () => {
    const stacked = stackValues(data, { offset: "diverging" });
    const defaultStacked = stackValues(data);

    expect(stacked.map(({ y0, y1 }) => [y0, y1])).toEqual([
      [0, 6],
      [6, 10],
      [0, -2],
      [-2, -10],
    ]);
    expect(defaultStacked.map(({ y0, y1 }) => [y0, y1])).toEqual(
      stacked.map(({ y0, y1 }) => [y0, y1]),
    );
    expect(Object.isFrozen(stacked)).toBe(true);
  });

  it("should normalize positive and negative totals independently given signed values when expanding", () => {
    const stacked = stackValues(data, { offset: "expand" });

    expect(stacked[0]).toMatchObject({ y0: 0, y1: 0.6 });
    expect(stacked[1]).toMatchObject({ y0: 0.6, y1: 1 });
    expect(stacked[2]).toMatchObject({ y0: 0, y1: -0.2 });
    expect(stacked[3]).toMatchObject({ y0: -0.2, y1: -1 });
  });

  it("should reject unsupported runtime options given malformed stack configuration", () => {
    expect(() => stackValues(data, { offset: "invalid" as "zero" })).toThrow(TypeError);
    expect(() => stackValues(data, { order: "invalid" as "none" })).toThrow(TypeError);
  });

  it("should accumulate signed values sequentially given the zero offset when stacking", () => {
    const stacked = stackValues(data, { offset: "zero" });

    expect(stacked.map(({ y0, y1 }) => [y0, y1])).toEqual([
      [0, 6],
      [6, 10],
      [10, 8],
      [8, 0],
    ]);
  });

  it("should omit non-finite data and restore source order given stack ordering when laying out", () => {
    const stacked = stackValues(
      [
        { key: "x", series: "large", value: 5, index: 0 },
        { key: "x", series: "missing", value: Number.NaN, index: 1 },
        { key: "x", series: "small", value: 2, index: 2 },
      ],
      { order: "ascending" },
    );

    expect(stacked.map(({ index }) => index)).toEqual([0, 2]);
    expect(stacked[0]).toMatchObject({ y0: 2, y1: 7 });
    expect(stacked[1]).toMatchObject({ y0: 0, y1: 2 });
  });
});

describe("moving windows and regression", () => {
  it("should ignore missing samples and honor partial windows given observations when smoothing", () => {
    const values = [1, null, 3, 5, Number.NaN];

    expect(movingWindowValues(values, { window: 3 })).toEqual([1, 1, 2, 4, 4]);
    expect(movingWindowValues(values, { window: 3, partial: false })).toEqual([
      null,
      null,
      2,
      4,
      4,
    ]);
    expect(movingWindowValues(values, { window: 2, operation: "sum" })).toEqual([1, 1, 3, 8, 5]);
    expect(() => movingWindowValues(values, { window: 0 })).toThrow(RangeError);
    expect(() => movingWindowValues(values, { window: 0.5 })).toThrow(RangeError);
    expect(() => movingWindowValues(values, { window: Number.NaN })).toThrow(RangeError);
    expect(() => movingWindowValues(values, { window: 2, operation: "invalid" as "mean" })).toThrow(
      TypeError,
    );
  });

  it("should evaluate a typed moving expression given row fields when computing channels", () => {
    const rows = [{ value: 2 }, { value: 4 }, { value: 8 }];

    const result = evaluateChannel(rows, movingAverage("value", { window: 2 }));

    expect(result).toEqual([2, 3, 6]);
  });

  it("should fit finite pairs and omit missing observations given linear samples when regressing", () => {
    const regression = linearRegression([0, 1, 2, 3, Number.POSITIVE_INFINITY], [1, 3, null, 7, 9]);

    expect(regression.slope).toBeCloseTo(2);
    expect(regression.intercept).toBeCloseTo(1);
    expect(regression.r2).toBeCloseTo(1);
    expect(regression.predict(4)).toBeCloseTo(9);
  });

  it("should return a stable constant fit given degenerate samples when regressing", () => {
    const regression = linearRegression([2, 2, null], [3, 5, 100]);

    expect(regression.slope).toBe(0);
    expect(regression.intercept).toBe(4);
    expect(regression.r2).toBe(0);
  });
});

describe("row transforms", () => {
  it("should filter then stably sort without mutating input given transform descriptors when applying", () => {
    const first = { id: "first", group: "keep", value: 2 };
    const second = { id: "second", group: "drop", value: 0 };
    const third = { id: "third", group: "keep", value: 1 };
    const fourth = { id: "fourth", group: "keep", value: 2 };
    const missing = { id: "missing", group: "keep", value: null };
    const rows = Object.freeze([first, second, third, fourth, missing]);

    const result = applyRowTransforms(rows, [
      filterRows((row) => row.group === "keep"),
      sortRows({ by: "value", direction: "ascending" }),
    ]);

    expect(result.map(({ id }) => id)).toEqual(["third", "first", "fourth", "missing"]);
    expect(result[1]).toBe(first);
    expect(rows.map(({ id }) => id)).toEqual(["first", "second", "third", "fourth", "missing"]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("should reject foreign descriptors given invalid transforms when applying", () => {
    expect(() => applyRowTransforms([{ value: 1 }], { kind: "filter" } as never)).toThrow(
      TypeError,
    );
  });
});

describe("hierarchy partitioning", () => {
  it("should derive parent totals and normalized rectangles given flat rows when partitioning", () => {
    const rows = [
      { id: "root", parentId: null, value: 0 },
      { id: "a", parentId: "root", value: 3 },
      { id: "b", parentId: "root", value: 1 },
      { id: "leaf", parentId: "a", value: 2 },
    ];

    const partitioned = partitionRows(rows, {
      id: "id",
      parentId: "parentId",
      value: "value",
    });

    expect(partitioned).toHaveLength(4);
    expect(partitioned.find(({ id }) => id === "root")).toMatchObject({
      depth: 0,
      value: 4,
      x0: 0,
      x1: 1,
      y0: 0,
      y1: 1 / 3,
    });
    expect(partitioned.find(({ id }) => id === "a")).toMatchObject({
      depth: 1,
      value: 3,
      x0: 0,
      x1: 0.75,
      y0: 1 / 3,
      y1: 2 / 3,
    });
    expect(partitioned.find(({ id }) => id === "b")).toMatchObject({
      depth: 1,
      value: 1,
      x0: 0.75,
      x1: 1,
    });
    expect(partitioned.find(({ id }) => id === "leaf")).toMatchObject({
      depth: 2,
      value: 2,
      x0: 0,
      x1: 0.75,
      y0: 2 / 3,
      y1: 1,
    });
    expect(Object.isFrozen(partitioned)).toBe(true);
  });

  it("should reject invalid hierarchies given duplicate or cyclic ids when partitioning", () => {
    expect(() =>
      partitionRows(
        [
          { id: "same", parentId: null, value: 1 },
          { id: "same", parentId: null, value: 2 },
        ],
        { id: "id", parentId: "parentId", value: "value" },
      ),
    ).toThrow(/Duplicate partition id same/);

    expect(() =>
      partitionRows(
        [
          { id: "a", parentId: "b", value: 1 },
          { id: "b", parentId: "a", value: 1 },
        ],
        { id: "id", parentId: "parentId", value: "value" },
      ),
    ).toThrow(/Partition cycle detected/);

    expect(() =>
      partitionRows([{ id: "orphan", parentId: "missing", value: 1 }], {
        id: "id",
        parentId: "parentId",
        value: "value",
      }),
    ).toThrow(/unknown parent missing/i);

    expect(() =>
      partitionRows([{ id: Number.NaN, parentId: null, value: 1 }], {
        id: "id",
        parentId: "parentId",
        value: "value",
      }),
    ).toThrow(/finite/i);
    expect(() =>
      partitionRows([{ id: "root", parentId: null, value: 1 }], {
        id: "id",
        parentId: "parentId",
        value: "value",
        padding: -1,
      }),
    ).toThrow(RangeError);
    expect(() =>
      partitionRows([{ id: "root", children: "invalid", value: 1 }], {
        id: "id",
        children: "children",
        value: "value",
      }),
    ).toThrow(/children must be an array/i);
  });
});

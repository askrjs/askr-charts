import { describe, expect, it } from "vite-plus/test";

import {
  appendPlotRows,
  readRowKey,
  removePlotRows,
  trimPlotRows,
  upsertPlotRows,
} from "../src/rows";

interface Row {
  readonly id: string;
  readonly value: number;
  readonly at: Date;
}

function row(id: string, value: number, at = value * 1_000): Row {
  return Object.freeze({ id, value, at: new Date(at) });
}

describe("plot row keys", () => {
  it("should read stable field and accessor keys given valid rows when resolving identity", () => {
    const value = row("alpha", 10);

    expect(readRowKey(value, 3, "id")).toBe("alpha");
    expect(readRowKey(value, 3, (_row, index) => index + 100)).toBe(103);
  });

  it("should reject invalid identities given missing or non-finite keys when resolving identity", () => {
    expect(() => readRowKey({ id: undefined }, 0, "id")).toThrow(TypeError);
    expect(() => readRowKey({ id: Number.NaN }, 1, "id")).toThrow(TypeError);
    expect(() => readRowKey({ id: Number.POSITIVE_INFINITY }, 2, "id")).toThrow(TypeError);
  });
});

describe("immutable plot row updates", () => {
  it("should append without mutating inputs given one or many rows when extending live data", () => {
    const first = row("a", 1);
    const second = row("b", 2);
    const third = row("c", 3);
    const source = Object.freeze([first]);

    const appended = appendPlotRows(source, second);
    const appendedMany = appendPlotRows(appended, [third]);

    expect(source).toEqual([first]);
    expect(appended).toEqual([first, second]);
    expect(appendedMany).toEqual([first, second, third]);
    expect(Object.isFrozen(appended)).toBe(true);
    expect(Object.isFrozen(appendedMany)).toBe(true);
    expect(appendPlotRows(source, [])).toBe(source);
  });

  it("should retain positions and untouched references given stable keys when upserting rows", () => {
    const first = row("a", 1);
    const second = row("b", 2);
    const replacement = row("a", 10);
    const added = row("c", 3);
    const source = Object.freeze([first, second]);

    const result = upsertPlotRows(source, [replacement, added], "id");

    expect(result).toEqual([replacement, second, added]);
    expect(result[1]).toBe(second);
    expect(source).toEqual([first, second]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(upsertPlotRows(source, [], "id")).toBe(source);
  });

  it("should reject ambiguous updates given duplicate keys when upserting rows", () => {
    const duplicateSource = [row("a", 1), row("a", 2)];
    const source = [row("a", 1)];

    expect(() => upsertPlotRows(duplicateSource, row("b", 2), "id")).toThrow(
      /Duplicate plot row key a in existing rows/,
    );
    expect(() => upsertPlotRows(source, [row("b", 2), row("b", 3)], "id")).toThrow(
      /Duplicate plot row key b in upsert rows/,
    );
  });

  it("should remove matching rows and preserve order given keys or a predicate when pruning data", () => {
    const first = row("a", 1);
    const second = row("b", 2);
    const third = row("c", 3);
    const source = Object.freeze([first, second, third]);

    const keyed = removePlotRows(source, new Set(["b"]), "id");
    const predicated = removePlotRows(source, (_value, index) => index % 2 === 0);

    expect(keyed).toEqual([first, third]);
    expect(predicated).toEqual([second]);
    expect(Object.isFrozen(keyed)).toBe(true);
    expect(Object.isFrozen(predicated)).toBe(true);
    expect(removePlotRows(source, ["missing"], "id")).toBe(source);
    expect(() => removePlotRows(source, ["a"])).toThrow(TypeError);
    expect(removePlotRows([{ "": "keep" }, { "": "remove" }], ["remove"], "")).toEqual([
      { "": "keep" },
    ]);
  });
});

describe("plot row trimming", () => {
  it("should retain the newest bounded suffix given row limits when trimming live data", () => {
    const source = Object.freeze([row("a", 1), row("b", 2), row("c", 3), row("d", 4)]);

    const latest = trimPlotRows(source, { rows: 2 });

    expect(latest.map(({ id }) => id)).toEqual(["c", "d"]);
    expect(Object.isFrozen(latest)).toBe(true);
    expect(trimPlotRows(source, 0)).toEqual([]);
    expect(trimPlotRows(source, 10)).toBe(source);
  });

  it("should retain every in-window row given unordered timestamps when trimming by time", () => {
    const source = Object.freeze([
      row("old-first", 1, 1_000),
      row("recent-first", 2, 9_000),
      row("old-later", 3, 2_000),
      row("recent-last", 4, 10_000),
    ]);

    const result = trimPlotRows(source, {
      durationMs: 2_000,
      field: "at",
      now: new Date(10_000),
    });

    expect(result.map(({ id }) => id)).toEqual(["recent-first", "recent-last"]);
    expect(source).toHaveLength(4);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("should derive the latest timestamp and reject invalid windows given time data when trimming", () => {
    const source = Object.freeze([
      row("old", 1, 1_000),
      row("edge", 2, 8_000),
      row("latest", 3, 10_000),
    ]);

    expect(
      trimPlotRows(source, { durationMs: 2_000, field: (_value) => _value.at }).map(({ id }) => id),
    ).toEqual(["edge", "latest"]);
    expect(() => trimPlotRows(source, { durationMs: -1, field: "at" })).toThrow(RangeError);
    expect(() => trimPlotRows(source, { durationMs: Number.NaN, field: "at" })).toThrow(RangeError);
    expect(() => trimPlotRows(source, { rows: Number.NaN })).toThrow(RangeError);
    expect(() => trimPlotRows(source, { rows: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => trimPlotRows(source, { durationMs: 1_000, field: "at", now: Number.NaN })).toThrow(
      RangeError,
    );
    expect(() =>
      trimPlotRows(source, { durationMs: 1_000, field: "at", now: new Date(Number.NaN) }),
    ).toThrow(RangeError);
  });
});

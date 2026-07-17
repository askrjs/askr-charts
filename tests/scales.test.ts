import { describe, expect, it } from "vite-plus/test";

import { createScale, inferScaleType, type ResolvedScale, type ScaleInput } from "../src/scales";

function mappedNumber(scale: ResolvedScale, value: ScaleInput): number {
  const mapped = scale.map(value);
  expect(typeof mapped).toBe("number");
  return mapped as number;
}

function invertedNumber(scale: ResolvedScale, value: number): number {
  const inverted = scale.invert?.(value);
  expect(typeof inverted).toBe("number");
  return inverted as number;
}

describe("scale inference", () => {
  it("should infer channel defaults given mixed missing values when inspecting runtime data", () => {
    expect(inferScaleType([1, null, Number.NaN, 4], "x")).toBe("linear");
    expect(inferScaleType([new Date(0), new Date(Number.NaN)], "x")).toBe("time");
    expect(inferScaleType(["alpha", undefined, "beta"], "y")).toBe("band");
    expect(inferScaleType([1, 2, 3], "color")).toBe("continuous-color");
    expect(inferScaleType(["open", "closed"], "color")).toBe("ordinal-color");
    expect(inferScaleType([], "x")).toBe("linear");
  });
});

describe("continuous coordinate scales", () => {
  it("should preserve signed values given missing observations when deriving a linear domain", () => {
    const scale = createScale({
      name: "signed",
      type: "linear",
      values: [-10, null, 5, Number.NaN],
      range: [0, 150],
    });

    expect(scale.domain).toEqual([-10, 5]);
    expect(scale.omittedValueCount).toBe(2);
    expect(mappedNumber(scale, -10)).toBe(0);
    expect(mappedNumber(scale, 0)).toBe(100);
    expect(mappedNumber(scale, 5)).toBe(150);
    expect(invertedNumber(scale, 100)).toBeCloseTo(0);
    expect(scale.ticks(4)).toEqual([-10, -5, 0, 5]);
  });

  it("should extrapolate or clamp given out-of-domain values when clamp changes", () => {
    const open = createScale({ type: "linear", domain: [0, 10], range: [0, 100] });
    const clamped = createScale({
      type: "linear",
      domain: [0, 10],
      range: [0, 100],
      clamp: true,
    });

    expect(mappedNumber(open, 20)).toBe(200);
    expect(invertedNumber(open, 200)).toBe(20);
    expect(mappedNumber(clamped, 20)).toBe(100);
    expect(invertedNumber(clamped, 200)).toBe(10);
  });

  it("should expand to round boundaries given a rough domain when nice is enabled", () => {
    const scale = createScale({
      type: "linear",
      domain: [0.7, 9.2],
      range: [0, 100],
      nice: 5,
    });

    expect(scale.domain).toEqual([0, 10]);
    expect(scale.ticks(5)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("should retain descending domain order given explicit endpoints when mapping and ticking", () => {
    const scale = createScale({ type: "linear", domain: [10, 0], range: [0, 100] });

    expect(scale.domain).toEqual([10, 0]);
    expect(mappedNumber(scale, 10)).toBe(0);
    expect(mappedNumber(scale, 0)).toBe(100);
    expect(scale.ticks(5)).toEqual([10, 8, 6, 4, 2, 0]);
  });

  it("should reverse output direction given an ascending range when reverse is enabled", () => {
    const scale = createScale({
      type: "linear",
      domain: [0, 10],
      range: [0, 100],
      reverse: true,
    });

    expect(scale.range).toEqual([100, 0]);
    expect(mappedNumber(scale, 0)).toBe(100);
    expect(mappedNumber(scale, 10)).toBe(0);
    expect(invertedNumber(scale, 25)).toBeCloseTo(7.5);
  });

  it("should preserve negative symmetry given a power scale when exponentiation is applied", () => {
    const scale = createScale({
      type: "power",
      domain: [-4, 4],
      range: [0, 100],
      exponent: 2,
    });

    expect(mappedNumber(scale, -2)).toBeCloseTo(37.5);
    expect(mappedNumber(scale, 0)).toBe(50);
    expect(mappedNumber(scale, 2)).toBeCloseTo(62.5);
    expect(invertedNumber(scale, 37.5)).toBeCloseTo(-2);
  });

  it("should retain zero and signed extremes given a symlog scale when mapping and inverting", () => {
    const scale = createScale({
      type: "symlog",
      domain: [-99, 99],
      range: [0, 200],
      constant: 1,
    });

    expect(mappedNumber(scale, -99)).toBeCloseTo(0);
    expect(mappedNumber(scale, 0)).toBeCloseTo(100);
    expect(mappedNumber(scale, 99)).toBeCloseTo(200);
    expect(invertedNumber(scale, mappedNumber(scale, -9))).toBeCloseTo(-9);
  });

  it("should omit nonpositive observations given a log scale when deriving its domain", () => {
    const scale = createScale({
      type: "log",
      values: [-5, 0, 1, 10, 100, Number.POSITIVE_INFINITY],
      range: [0, 100],
      unknown: "missing",
    });

    expect(scale.domain).toEqual([1, 100]);
    expect(scale.omittedValueCount).toBe(3);
    expect(mappedNumber(scale, 10)).toBeCloseTo(50);
    expect(scale.map(0)).toBe("missing");
    expect(scale.ticks(3)).toEqual(expect.arrayContaining([1, 10, 100]));
  });

  it("should honor a custom base given a log domain when mapping powers", () => {
    const scale = createScale({
      type: "log",
      domain: [1, 8],
      range: [0, 90],
      base: 2,
    });

    expect(mappedNumber(scale, 2)).toBeCloseTo(30);
    expect(mappedNumber(scale, 4)).toBeCloseTo(60);
    expect(scale.ticks(4)).toEqual([1, 2, 4, 8]);
  });

  it("should round to base powers given an uneven log domain when nice is enabled", () => {
    const scale = createScale({
      type: "log",
      domain: [2, 80],
      range: [0, 100],
      nice: true,
    });

    expect(scale.domain).toEqual([1, 100]);
  });

  it("should derive finite bounds given one hundred thousand values when scanning a large domain", () => {
    const values = Array.from({ length: 100_000 }, (_, index) => index - 50_000);
    const scale = createScale({ type: "linear", values, range: [0, 1] });

    expect(scale.domain).toEqual([-50_000, 49_999]);
    expect(scale.omittedValueCount).toBe(0);
  });
});

describe("categorical coordinate scales", () => {
  it("should calculate stable positions given a padded band domain when laying out categories", () => {
    const scale = createScale({
      type: "band",
      domain: ["a", "b", "c"],
      range: [0, 300],
      paddingInner: 0.2,
      paddingOuter: 0.1,
    });

    expect(scale.step).toBeCloseTo(100);
    expect(scale.bandwidth).toBeCloseTo(80);
    expect(mappedNumber(scale, "a")).toBeCloseTo(10);
    expect(mappedNumber(scale, "b")).toBeCloseTo(110);
    expect(mappedNumber(scale, "c")).toBeCloseTo(210);
    expect(scale.map("missing")).toBeUndefined();
  });

  it("should reverse category positions given a normal range when reverse is enabled", () => {
    const scale = createScale({
      type: "band",
      domain: ["a", "b", "c"],
      range: [0, 300],
      reverse: true,
    });

    expect(mappedNumber(scale, "a")).toBeCloseTo(200);
    expect(mappedNumber(scale, "c")).toBeCloseTo(0);
    expect(scale.bandwidth).toBeCloseTo(100);
  });

  it("should center points with zero bandwidth given outer padding when mapping categories", () => {
    const scale = createScale({
      type: "point",
      domain: ["a", "b", "c"],
      range: [0, 100],
      padding: 0.5,
    });

    expect(scale.bandwidth).toBe(0);
    expect(scale.step).toBeCloseTo(100 / 3);
    expect(mappedNumber(scale, "a")).toBeCloseTo(100 / 6);
    expect(mappedNumber(scale, "b")).toBeCloseTo(50);
    expect(mappedNumber(scale, "c")).toBeCloseTo(500 / 6);
  });

  it("should compare dates by timestamp given equivalent instances when mapping categories", () => {
    const scale = createScale({
      type: "point",
      domain: [new Date(0), new Date(1_000)],
      range: [0, 100],
    });

    expect(mappedNumber(scale, new Date(0))).toBe(0);
    expect(mappedNumber(scale, new Date(1_000))).toBe(100);
  });
});

describe("time scales", () => {
  it("should align local calendar ticks given uneven local times when nice is enabled", () => {
    const start = new Date(2024, 0, 1, 1, 20);
    const stop = new Date(2024, 0, 1, 5, 40);
    const scale = createScale({ type: "time", domain: [start, stop], range: [0, 100], nice: 5 });
    const domain = scale.domain as readonly Date[];
    const ticks = scale.ticks(5) as readonly Date[];

    expect(domain[0]?.getHours()).toBe(1);
    expect(domain[0]?.getMinutes()).toBe(0);
    expect(domain[1]?.getHours()).toBe(6);
    expect(domain[1]?.getMinutes()).toBe(0);
    expect(ticks.every((tick) => tick.getMinutes() === 0)).toBe(true);
  });

  it("should align UTC calendar ticks given uneven timestamps when utc is selected", () => {
    const start = new Date(Date.UTC(2024, 0, 1, 1, 20));
    const stop = new Date(Date.UTC(2024, 0, 1, 5, 40));
    const scale = createScale({ type: "utc", domain: [start, stop], range: [0, 100], nice: 5 });
    const domain = scale.domain as readonly Date[];
    const ticks = scale.ticks(5) as readonly Date[];

    expect(domain[0]?.getUTCHours()).toBe(1);
    expect(domain[0]?.getUTCMinutes()).toBe(0);
    expect(domain[1]?.getUTCHours()).toBe(6);
    expect(domain[1]?.getUTCMinutes()).toBe(0);
    expect(ticks.every((tick) => tick.getUTCMinutes() === 0)).toBe(true);
  });

  it("should round-trip dates given a reversed numeric range when mapping and inverting", () => {
    const start = new Date(Date.UTC(2024, 0, 1));
    const stop = new Date(Date.UTC(2024, 0, 11));
    const middle = new Date(Date.UTC(2024, 0, 6));
    const scale = createScale({ type: "utc", domain: [start, stop], range: [100, 0] });
    const inverted = scale.invert?.(50);

    expect(mappedNumber(scale, middle)).toBeCloseTo(50);
    expect(inverted).toBeInstanceOf(Date);
    expect((inverted as Date).getTime()).toBe(middle.getTime());
  });
});

describe("color scales", () => {
  it("should cycle a fixed palette given unique categories when mapping ordinal colors", () => {
    const scale = createScale({
      type: "ordinal-color",
      values: ["open", "closed", "open", null],
      range: ["red", "blue"],
      unknown: "transparent",
    });

    expect(scale.domain).toEqual(["open", "closed"]);
    expect(scale.omittedValueCount).toBe(1);
    expect(scale.map("open")).toBe("red");
    expect(scale.map("closed")).toBe("blue");
    expect(scale.map("pending")).toBe("transparent");
    expect(scale.ticks()).toEqual(["open", "closed"]);
  });

  it("should reverse palette assignment given ordinal categories when reverse is enabled", () => {
    const scale = createScale({
      type: "ordinal-color",
      domain: ["open", "closed"],
      range: ["red", "blue"],
      reverse: true,
    });

    expect(scale.map("open")).toBe("blue");
    expect(scale.map("closed")).toBe("red");
  });

  it("should interpolate RGB channels given a numeric domain when mapping continuous colors", () => {
    const scale = createScale({
      type: "continuous-color",
      domain: [0, 100],
      range: ["#000000", "#ffffff"],
      unknown: "transparent",
    });

    expect(scale.map(0)).toBe("#000000");
    expect(scale.map(50)).toBe("rgb(128, 128, 128)");
    expect(scale.map(100)).toBe("#ffffff");
    expect(scale.map("invalid")).toBe("transparent");
    expect(scale.ticks(5)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it("should use date ticks given temporal values when mapping continuous colors", () => {
    const start = new Date(Date.UTC(2024, 0, 1));
    const stop = new Date(Date.UTC(2024, 0, 3));
    const middle = new Date(Date.UTC(2024, 0, 2));
    const scale = createScale({
      type: "continuous-color",
      values: [start, stop],
      range: ["blue", "red"],
    });

    expect(scale.map(middle)).toBe("rgb(128, 0, 128)");
    expect(scale.ticks(3).every((tick) => tick instanceof Date)).toBe(true);
  });
});

describe("resolved scale contract", () => {
  it("should expose frozen configuration given a resolved scale when consumers inspect it", () => {
    const scale = createScale({
      name: "immutable",
      type: "linear",
      domain: [0, 1],
      range: [0, 10],
    });

    expect(Object.isFrozen(scale)).toBe(true);
    expect(Object.isFrozen(scale.domain)).toBe(true);
    expect(Object.isFrozen(scale.range)).toBe(true);
    expect(Object.isFrozen(scale.ticks())).toBe(true);
    expect(scale.name).toBe("immutable");
  });

  it("should reject incompatible output types given coordinate scales when resolving ranges", () => {
    expect(() => createScale({ type: "linear", domain: [0, 1], range: ["red", "blue"] })).toThrow(
      "numeric range",
    );
    expect(() => createScale({ type: "ordinal-color", domain: ["a"], range: [0, 1] })).toThrow(
      "string range",
    );
  });
});

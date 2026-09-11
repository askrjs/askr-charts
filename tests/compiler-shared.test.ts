import { describe, expect, it } from "vite-plus/test";

import { channelSeries, resolveDash, toCurve, toPointShape } from "../src/compiler/shared";

describe("compiler/shared channelSeries", () => {
  it("should encode strings, numbers, dates, and booleans with distinct type prefixes", () => {
    expect(channelSeries("a")).toBe("string:a");
    expect(channelSeries(-0)).toBe("number:-0");
    expect(channelSeries(true)).toBe("boolean:true");
    expect(channelSeries(new Date(0))).toBe("date:0");
  });

  it("should return null for null, undefined, and non-finite values", () => {
    expect(channelSeries(null)).toBeNull();
    expect(channelSeries(undefined)).toBeNull();
    expect(channelSeries(Number.NaN)).toBeNull();
  });
});

describe("compiler/shared resolveDash", () => {
  it("should return an empty array when no dash is provided", () => {
    expect(resolveDash(undefined, "Line")).toEqual([]);
  });

  it("should throw for a non-array dash value", () => {
    expect(() => resolveDash("solid", "Line")).toThrow(/Line dash must be an array/);
  });

  it("should throw when a dash entry is negative", () => {
    expect(() => resolveDash([4, -1], "Rule")).toThrow(
      /Rule dash entries must be finite non-negative numbers/,
    );
  });
});

describe("compiler/shared curve and shape defaults", () => {
  it("should fall back to linear for an unrecognized curve", () => {
    expect(toCurve("wiggly")).toBe("linear");
    expect(toCurve("step")).toBe("step");
  });

  it("should fall back to circle for an unrecognized point shape", () => {
    expect(toPointShape("hexagon")).toBe("circle");
    expect(toPointShape("diamond")).toBe("diamond");
  });
});

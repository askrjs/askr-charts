import { describe, expect, it } from "vite-plus/test";

import { clampViewDomain, isContinuousScale } from "../src/controller/viewport";
import { createScale } from "../src/scales";

describe("controller/viewport clampViewDomain", () => {
  it("should leave the domain untouched when there is no full-extent bound", () => {
    expect(clampViewDomain(2, 8, null, null)).toEqual([2, 8]);
  });

  it("should clamp a span that exceeds the full extent to the full extent, preserving direction", () => {
    expect(clampViewDomain(-5, 20, 0, 10)).toEqual([0, 10]);
    expect(clampViewDomain(20, -5, 0, 10)).toEqual([10, 0]);
  });

  it("should shift an out-of-bounds window back inside the full extent", () => {
    expect(clampViewDomain(-2, 3, 0, 10)).toEqual([0, 5]);
    expect(clampViewDomain(8, 13, 0, 10)).toEqual([5, 10]);
  });
});

describe("controller/viewport isContinuousScale", () => {
  it("should treat linear, time, and log scales as continuous", () => {
    const linear = createScale({
      name: "x",
      channel: "x",
      type: "linear",
      domain: [0, 1],
      range: [0, 100],
    });
    expect(isContinuousScale(linear)).toBe(true);
  });

  it("should treat band and ordinal-color scales as non-continuous", () => {
    const band = createScale({
      name: "x",
      channel: "x",
      type: "band",
      domain: ["a", "b"],
      range: [0, 100],
    });
    expect(isContinuousScale(band)).toBe(false);
    expect(isContinuousScale(undefined)).toBe(false);
  });
});

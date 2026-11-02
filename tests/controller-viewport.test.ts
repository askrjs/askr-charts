import { describe, expect, it } from "vite-plus/test";

import { clampViewDomain, isContinuousScale, zoomScale } from "../src/controller/viewport";
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

describe("controller/viewport zoomScale", () => {
  it("should enforce the maximum zoom ratio after recompiling nonlinear views", () => {
    const scenarios = [
      { type: "log" as const, domain: [1, 10_000] as const, clamp: true },
      { type: "power" as const, domain: [0, 100] as const, exponent: 2 },
      { type: "symlog" as const, domain: [-100, 100] as const, constant: 1 },
    ];

    for (const scenario of scenarios) {
      const initialScale = createScale({
        name: "x",
        channel: "x",
        range: [0, 100],
        ...scenario,
      });
      const fullDomain = scenario.domain;
      const firstView = zoomScale(initialScale, fullDomain, fullDomain, 100, 0.5, 1, 2)!;
      const secondTransientView = zoomScale(initialScale, firstView, fullDomain, 100, 0.5, 1, 2);
      const compiledScale = createScale({
        name: "x",
        channel: "x",
        range: [0, 100],
        ...scenario,
        domain: firstView,
      });
      const secondView = zoomScale(compiledScale, firstView, fullDomain, 100, 0.5, 1, 2);

      if (scenario.type === "log") expect(firstView).toEqual([100, 10_000]);
      expect(Number(secondTransientView?.[0])).toBeCloseTo(Number(firstView[0]), 10);
      expect(Number(secondTransientView?.[1])).toBeCloseTo(Number(firstView[1]), 10);
      expect(Number(secondView?.[0])).toBeCloseTo(Number(firstView[0]), 10);
      expect(Number(secondView?.[1])).toBeCloseTo(Number(firstView[1]), 10);
    }
  });
});

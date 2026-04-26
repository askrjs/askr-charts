import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { getAnimationDataAttrs, getAnimationStyle, normalizeAnimation } from "../src/core";

describe("chart animation core", () => {
  it("normalizes boolean animation values against defaults", () => {
    expect(normalizeAnimation(true, { type: "grow" })).toEqual({
      enabled: true,
      type: "grow",
      duration: 300,
      delay: 0,
      stagger: 24,
      easing: "ease-out",
    });

    expect(normalizeAnimation(undefined, { type: "grow" })).toEqual({
      enabled: false,
      type: "grow",
      duration: 300,
      delay: 0,
      stagger: 24,
      easing: "ease-out",
    });
  });

  it("normalizes object animation values and preserves explicit overrides", () => {
    expect(
      normalizeAnimation(
        {
          type: "slide",
          duration: 420,
          delay: 12,
          stagger: 8,
          easing: "linear",
        },
        { type: "fade" },
      ),
    ).toEqual({
      enabled: true,
      type: "slide",
      duration: 420,
      delay: 12,
      stagger: 8,
      easing: "linear",
    });
  });

  it("disables animation for false, none, and type none", () => {
    expect(normalizeAnimation(false, { type: "grow" }).enabled).toBe(false);
    expect(normalizeAnimation("none", { type: "grow" })).toMatchObject({
      enabled: false,
      type: "none",
    });
    expect(normalizeAnimation({ type: "none" }, { type: "grow" })).toMatchObject({
      enabled: false,
      type: "none",
    });
  });

  it("generates CSS variable styles in milliseconds", () => {
    expect(
      getAnimationStyle({
        enabled: true,
        type: "fade",
        duration: 240,
        delay: 16,
        stagger: 5,
        easing: "ease-in-out",
      }),
    ).toEqual({
      "--ak-chart-animation-duration": "240ms",
      "--ak-chart-animation-delay": "16ms",
      "--ak-chart-animation-stagger": "5ms",
      "--ak-chart-animation-easing": "ease-in-out",
    });
  });

  it("generates root animation data attributes", () => {
    expect(
      getAnimationDataAttrs({
        enabled: true,
        type: "sweep",
        duration: 300,
        delay: 0,
        stagger: 24,
        easing: "ease-out",
      }),
    ).toEqual({
      "data-ak-animate": "true",
      "data-ak-animation": "sweep",
    });

    expect(
      getAnimationDataAttrs({
        enabled: false,
        type: "grow",
        duration: 300,
        delay: 0,
        stagger: 24,
        easing: "ease-out",
      }),
    ).toEqual({
      "data-ak-animate": "false",
      "data-ak-animation": "none",
    });
  });

  it("includes reduced-motion animation guards in the shared stylesheet", () => {
    const css = readFileSync(join(__dirname, "..", "src", "css", "animations.css"), "utf-8");

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation: none !important");
    expect(css).toContain("transition: none !important");
  });
});

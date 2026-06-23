import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  CHART_EASING_SPRING,
  CHART_EASING_SPRING_SUBTLE,
  getAnimationDataAttrs,
  getAnimationStyle,
  normalizeAnimation,
} from "../src/core";

describe("chart animation core", () => {
  it("should normalizes boolean animation values against defaults", () => {
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

  it("should normalizes object animation values and preserves explicit overrides", () => {
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

  it("should normalizes invalid default animation timings", () => {
    const animation = normalizeAnimation(true, {
      type: "grow",
      duration: Number.NaN,
      delay: Number.POSITIVE_INFINITY,
      stagger: -12,
    });

    expect(animation).toMatchObject({
      enabled: true,
      type: "grow",
      duration: 300,
      delay: 0,
      stagger: 0,
    });
    expect(getAnimationStyle(animation)).toMatchObject({
      "--ak-chart-animation-duration": "300ms",
      "--ak-chart-animation-delay": "0ms",
      "--ak-chart-animation-stagger": "0ms",
    });
  });

  it("should disables animation for false, none, and type none", () => {
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

  it("should generates CSS variable styles in milliseconds", () => {
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

  it("should resolves spring easing presets and reveal animation types", () => {
    expect(CHART_EASING_SPRING).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)");
    expect(CHART_EASING_SPRING_SUBTLE).toBe("cubic-bezier(0.22, 1.00, 0.36, 1)");
    expect(
      getAnimationStyle({
        enabled: true,
        type: "reveal",
        duration: 300,
        delay: 0,
        stagger: 24,
        easing: "spring",
      }),
    ).toMatchObject({
      "--ak-chart-animation-easing": CHART_EASING_SPRING,
    });
    expect(
      getAnimationStyle({
        enabled: true,
        type: "reveal",
        duration: 300,
        delay: 0,
        stagger: 24,
        easing: "spring-subtle",
      }),
    ).toMatchObject({
      "--ak-chart-animation-easing": CHART_EASING_SPRING_SUBTLE,
    });
  });

  it("should generates root animation data attributes", () => {
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

  it("should includes reduced-motion animation guards in the shared stylesheet", () => {
    const css = readFileSync(
      join(__dirname, "..", "src", "charts", "default", "styles", "base", "animations.css"),
      "utf-8",
    );

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation: none !important");
    expect(css).toContain("transition: none !important");
  });

  it("should keeps the phase 1 chart animation hooks in sync with the CSS files", () => {
    const animationsCss = readFileSync(
      join(__dirname, "..", "src", "charts", "default", "styles", "base", "animations.css"),
      "utf-8",
    );
    const tooltipCss = readFileSync(
      join(__dirname, "..", "src", "charts", "default", "styles", "overlays", "tooltip.css"),
      "utf-8",
    );
    const radialGaugeCss = readFileSync(
      join(__dirname, "..", "src", "charts", "default", "styles", "display", "radial-gauge.css"),
      "utf-8",
    );

    expect(animationsCss).toContain("--ak-chart-animation-stagger: 24ms;");
    expect(animationsCss).toContain('data-ak-animation="sweep"');
    expect(animationsCss).toContain("@keyframes ak-chart-gauge-sweep");
    expect(animationsCss).toContain("@property --ak-chart-reveal-progress");
    expect(animationsCss).toContain("@keyframes ak-chart-reveal-line");
    expect(tooltipCss).toContain("@keyframes ak-tooltip-in");
    expect(radialGaugeCss).toContain("from 225deg");
    expect(radialGaugeCss).toContain("transparent 270deg 360deg");
  });
});

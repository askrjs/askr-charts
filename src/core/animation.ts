export type ChartAnimationType = "grow" | "fade" | "scale" | "sweep" | "slide" | "none";

export type ChartAnimation =
  | boolean
  | "none"
  | {
      type?: ChartAnimationType;
      duration?: number;
      delay?: number;
      stagger?: number;
      easing?: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | string;
    };

export type NormalizedChartAnimation = {
  enabled: boolean;
  type: string;
  duration: number;
  delay: number;
  stagger: number;
  easing: string;
};

export type ChartAnimationDefaults = Omit<NormalizedChartAnimation, "enabled">;

const BASE_DEFAULTS: ChartAnimationDefaults = {
  type: "fade",
  duration: 300,
  delay: 0,
  stagger: 24,
  easing: "ease-out",
};

function normalizeMs(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Number(value));
}

export function normalizeAnimation(
  animation: ChartAnimation | undefined,
  defaults: Partial<ChartAnimationDefaults> = {},
): NormalizedChartAnimation {
  const resolvedDefaults: ChartAnimationDefaults = {
    ...BASE_DEFAULTS,
    ...defaults,
  };

  if (animation === false || animation === "none") {
    return {
      enabled: false,
      ...resolvedDefaults,
      type: "none",
    };
  }

  if (animation === true || animation == null) {
    return {
      enabled: animation === true,
      ...resolvedDefaults,
    };
  }

  if (animation.type === "none") {
    return {
      enabled: false,
      ...resolvedDefaults,
      type: "none",
      duration: normalizeMs(animation.duration, resolvedDefaults.duration),
      delay: normalizeMs(animation.delay, resolvedDefaults.delay),
      stagger: normalizeMs(animation.stagger, resolvedDefaults.stagger),
      easing: animation.easing ?? resolvedDefaults.easing,
    };
  }

  return {
    enabled: true,
    type: animation.type ?? resolvedDefaults.type,
    duration: normalizeMs(animation.duration, resolvedDefaults.duration),
    delay: normalizeMs(animation.delay, resolvedDefaults.delay),
    stagger: normalizeMs(animation.stagger, resolvedDefaults.stagger),
    easing: animation.easing ?? resolvedDefaults.easing,
  };
}

export function getAnimationStyle(animation: NormalizedChartAnimation): Record<string, string> {
  return {
    "--ak-chart-animation-duration": `${animation.duration}ms`,
    "--ak-chart-animation-delay": `${animation.delay}ms`,
    "--ak-chart-animation-stagger": `${animation.stagger}ms`,
    "--ak-chart-animation-easing": animation.easing,
  };
}

export function getAnimationDataAttrs(
  animation: NormalizedChartAnimation,
): Record<string, string> {
  return {
    "data-ak-animate": String(animation.enabled),
    "data-ak-animation": animation.enabled ? animation.type : "none",
  };
}
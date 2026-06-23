export const CHART_EASING_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
export const CHART_EASING_SPRING_SUBTLE = "cubic-bezier(0.22, 1.00, 0.36, 1)";

export type ChartAnimationType = "grow" | "fade" | "scale" | "sweep" | "slide" | "reveal" | "none";

export type ChartAnimation =
  | boolean
  | "none"
  | {
      type?: ChartAnimationType;
      duration?: number;
      delay?: number;
      stagger?: number;
      easing?:
        | "linear"
        | "ease"
        | "ease-in"
        | "ease-out"
        | "ease-in-out"
        | "spring"
        | "spring-subtle"
        | string;
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

function resolveEasing(easing: string): string {
  if (easing === "spring") {
    return CHART_EASING_SPRING;
  }

  if (easing === "spring-subtle") {
    return CHART_EASING_SPRING_SUBTLE;
  }

  return easing;
}

export function normalizeAnimation(
  animation: ChartAnimation | undefined,
  defaults: Partial<ChartAnimationDefaults> = {},
): NormalizedChartAnimation {
  const rawDefaults = {
    ...BASE_DEFAULTS,
    ...defaults,
  };
  const resolvedDefaults: ChartAnimationDefaults = {
    type: rawDefaults.type ?? BASE_DEFAULTS.type,
    duration: normalizeMs(rawDefaults.duration, BASE_DEFAULTS.duration),
    delay: normalizeMs(rawDefaults.delay, BASE_DEFAULTS.delay),
    stagger: normalizeMs(rawDefaults.stagger, BASE_DEFAULTS.stagger),
    easing: rawDefaults.easing ?? BASE_DEFAULTS.easing,
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
    "--ak-chart-animation-easing": resolveEasing(animation.easing),
  };
}

export function getAnimationDataAttrs(animation: NormalizedChartAnimation): Record<string, string> {
  return {
    "data-ak-animate": String(animation.enabled),
    "data-ak-animation": animation.enabled ? animation.type : "none",
  };
}

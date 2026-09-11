import { createHitIndex, transformHitRegions } from "../hit-index";
import type { PlotView, ScaleValue } from "../model";
import { renderPlotChrome } from "../render";
import type { PlotScene } from "../scene-model";
import { scheduleCompile, updateLiveStatus } from "../controller";
import type { ControllerState, DragState } from "./state";

export function hasContinuousZoomAxis<Row>(state: ControllerState<Row>): boolean {
  const axes = state.scene.interactions.zoom?.axes ?? "xy";
  return (
    (axes.includes("x") && isContinuousScale(primaryScale(state.scene, "x"))) ||
    (axes.includes("y") && isContinuousScale(primaryScale(state.scene, "y")))
  );
}

export function isContinuousScale(scale: import("../scales").ResolvedScale | undefined): boolean {
  return scale != null && ["linear", "power", "log", "symlog", "time", "utc"].includes(scale.type);
}

export function axisScaleNames<Row>(scene: PlotScene<Row>, axis: "x" | "y"): readonly string[] {
  const names = new Set<string>();
  const primary = primaryScale(scene, axis);
  if (primary) names.add(primary.name);
  for (const candidate of scene.axes) {
    const horizontal = candidate.orientation === "top" || candidate.orientation === "bottom";
    if ((axis === "x") === horizontal) names.add(candidate.scale);
  }
  return [...names];
}

export function zoomAt<Row>(
  state: ControllerState<Row>,
  x: number,
  y: number,
  factor: number,
  scheduleCommit: boolean,
): void {
  const interaction = state.scene.interactions.zoom;
  if (!interaction || !hasContinuousZoomAxis(state)) return;
  pauseFollowing(state);
  const current = state.transientView ?? currentDomainView(state.scene);
  const next: PlotView = { ...current };
  const scales = { ...current.scales };
  for (const axis of ["x", "y"] as const) {
    if (!interaction.axes.includes(axis)) continue;
    for (const name of axisScaleNames(state.scene, axis)) {
      const scale = state.scene.scales[name];
      if (!isContinuousScale(scale)) continue;
      const domain = current.scales?.[name] ?? (axis === "x" ? current.x : current.y);
      const full =
        state.fullView.scales?.[name] ?? (axis === "x" ? state.fullView.x : state.fullView.y);
      const updated = zoomScale(
        scale,
        domain,
        full,
        axis === "x" ? x : y,
        factor,
        interaction.min,
        interaction.max,
      );
      if (updated) scales[name] = updated;
      if (name === primaryScale(state.scene, axis)?.name) next[axis] = updated;
    }
  }
  next.scales = scales;
  setView(state, next, false);
  applyCanvasViewTransform(state, next, interaction.axes);
  if (scheduleCommit) scheduleTransientViewCommit(state);
}

function zoomScale(
  scale: import("../scales").ResolvedScale | undefined,
  domain: PlotView["x"],
  fullDomain: PlotView["x"],
  pixel: number,
  factor: number,
  minimumZoom: number,
  maximumZoom: number,
): readonly [ScaleValue, ScaleValue] | undefined {
  if (!scale || !domain) return domain;
  const start = numericValue(domain[0]);
  const stop = numericValue(domain[1]);
  const rangeStart = numericValue(scale.range[0]);
  const rangeStop = numericValue(scale.range[scale.range.length - 1]);
  if (start == null || stop == null || rangeStart == null || rangeStop == null) return domain;
  const rangeSpan = rangeStop - rangeStart;
  if (rangeSpan === 0 || stop === start) return domain;
  const fraction = Math.max(0, Math.min(1, (pixel - rangeStart) / rangeSpan));
  const fullStart = numericValue(fullDomain?.[0]);
  const fullStop = numericValue(fullDomain?.[1]);
  const fullSpan =
    fullStart == null || fullStop == null ? Math.abs(stop - start) : Math.abs(fullStop - fullStart);
  const lowerSpan = fullSpan / Math.max(1, maximumZoom);
  const upperSpan = fullSpan / Math.max(1, minimumZoom);
  const span = Math.max(lowerSpan, Math.min(upperSpan, Math.abs(stop - start) * factor));
  const direction = stop >= start ? 1 : -1;
  const requestedFactor = span / Math.abs(stop - start);
  const invertedStart = scale.invert?.(pixel + (rangeStart - pixel) * requestedFactor);
  const invertedStop = scale.invert?.(pixel + (rangeStop - pixel) * requestedFactor);
  const nextStart = numericValue(invertedStart) ?? start + direction * span * -fraction;
  const nextStop = numericValue(invertedStop) ?? nextStart + direction * span;
  const bounded = clampViewDomain(nextStart, nextStop, fullStart, fullStop);
  return [restoreValue(domain[0], bounded[0]), restoreValue(domain[1], bounded[1])];
}

export function panTo<Row>(
  state: ControllerState<Row>,
  drag: DragState,
  x: number,
  y: number,
): void {
  const interaction = state.scene.interactions.zoom;
  if (!interaction || !hasContinuousZoomAxis(state)) return;
  pauseFollowing(state);
  const next: PlotView = { ...drag.startView };
  const scales = { ...drag.startView.scales };
  for (const axis of ["x", "y"] as const) {
    if (!interaction.axes.includes(axis)) continue;
    for (const name of axisScaleNames(state.scene, axis)) {
      const scale = state.scene.scales[name];
      if (!isContinuousScale(scale)) continue;
      const domain =
        drag.startView.scales?.[name] ?? (axis === "x" ? drag.startView.x : drag.startView.y);
      const full =
        state.fullView.scales?.[name] ?? (axis === "x" ? state.fullView.x : state.fullView.y);
      const updated = panScale(
        scale,
        domain,
        full,
        axis === "x" ? drag.startX : drag.startY,
        axis === "x" ? x : y,
      );
      if (updated) scales[name] = updated;
      if (name === primaryScale(state.scene, axis)?.name) next[axis] = updated;
    }
  }
  next.scales = scales;
  setView(state, next, false);
  applyCanvasViewTransform(state, next, interaction.axes);
}

function panScale(
  scale: import("../scales").ResolvedScale | undefined,
  domain: PlotView["x"],
  fullDomain: PlotView["x"],
  startPixel: number,
  currentPixel: number,
): readonly [ScaleValue, ScaleValue] | undefined {
  if (!scale?.invert || !domain) return domain;
  const rangeStart = numericValue(scale.range[0]);
  const rangeStop = numericValue(scale.range[scale.range.length - 1]);
  const domainStart = numericValue(domain[0]);
  const domainStop = numericValue(domain[1]);
  if (rangeStart == null || rangeStop == null || domainStart == null || domainStop == null)
    return domain;
  const pixelDelta = startPixel - currentPixel;
  const shiftedStart = numericValue(scale.invert(rangeStart + pixelDelta));
  const shiftedStop = numericValue(scale.invert(rangeStop + pixelDelta));
  if (shiftedStart == null || shiftedStop == null) return domain;
  const bounded = clampViewDomain(
    shiftedStart,
    shiftedStop,
    numericValue(fullDomain?.[0]),
    numericValue(fullDomain?.[1]),
  );
  return [restoreValue(domain[0], bounded[0]), restoreValue(domain[1], bounded[1])];
}

export function pointInPlotArea<Row>(
  scene: PlotScene<Row>,
  point: { x: number; y: number },
): boolean {
  const area = scene.plotArea;
  return (
    point.x >= area.x &&
    point.x <= area.x + area.width &&
    point.y >= area.y &&
    point.y <= area.y + area.height
  );
}

export function setView<Row>(
  state: ControllerState<Row>,
  view: PlotView | undefined,
  commit = true,
): void {
  state.config.props.onViewChange?.(view ?? {});
  if (state.config.props.view === undefined) state.internalView = view;
  state.transientView = commit ? null : (view ?? {});
  if (commit) scheduleCompile(state);
}

export function resetView<Row>(state: ControllerState<Row>): void {
  state.followPaused = false;
  state.frozenFollowRows = null;
  const next = state.config.props.defaultView ?? {};
  setView(state, next);
}

export function resumeLive<Row>(state: ControllerState<Row>): void {
  state.followPaused = false;
  state.frozenFollowRows = null;
  setView(state, state.config.props.defaultView ?? {});
  updateLiveStatus(state);
}

export function pauseFollowing<Row>(state: ControllerState<Row>): void {
  if (!state.config.props.followLatest) return;
  if (!state.followPaused) state.frozenFollowRows = Object.freeze([...state.scene.sourceRows]);
  state.followPaused = true;
  updateLiveStatus(state);
}

export function copyPlotView(view: PlotView | undefined): PlotView | undefined {
  if (!view) return undefined;
  const copyDomain = (domain: PlotView["x"]) =>
    domain
      ? (Object.freeze(
          domain.map((value) => (value instanceof Date ? new Date(value.getTime()) : value)),
        ) as readonly [ScaleValue, ScaleValue])
      : undefined;
  const scales = view.scales
    ? Object.freeze(
        Object.fromEntries(
          Object.entries(view.scales).map(([name, domain]) => [name, copyDomain(domain)]),
        ) as Record<string, readonly [ScaleValue, ScaleValue]>,
      )
    : undefined;
  return Object.freeze({ x: copyDomain(view.x), y: copyDomain(view.y), scales });
}

export function currentDomainView<Row>(scene: PlotScene<Row>): PlotView {
  const scales: Record<string, readonly [ScaleValue, ScaleValue]> = {};
  for (const [name, scale] of Object.entries(scene.scales)) {
    if (scale.type === "ordinal-color" || scale.type === "continuous-color") continue;
    const domain = domainPair(scale.domain);
    if (domain) scales[name] = domain;
  }
  return {
    x: domainPair(primaryScale(scene, "x")?.domain),
    y: domainPair(primaryScale(scene, "y")?.domain),
    scales: Object.freeze(scales),
  };
}

export function primaryScale<Row>(
  scene: PlotScene<Row>,
  axis: "x" | "y",
): import("../scales").ResolvedScale | undefined {
  const direct = scene.scales[axis];
  if (direct) return direct;
  const sceneAxis = scene.axes.find((candidate) =>
    axis === "x"
      ? candidate.orientation === "top" || candidate.orientation === "bottom"
      : candidate.orientation === "left" || candidate.orientation === "right",
  );
  return sceneAxis ? scene.scales[sceneAxis.scale] : undefined;
}

export function clampViewDomain(
  start: number,
  stop: number,
  fullStart: number | null,
  fullStop: number | null,
): readonly [number, number] {
  if (fullStart == null || fullStop == null) return [start, stop];
  const direction = stop >= start ? 1 : -1;
  const fullMinimum = Math.min(fullStart, fullStop);
  const fullMaximum = Math.max(fullStart, fullStop);
  const span = Math.abs(stop - start);
  if (span >= fullMaximum - fullMinimum) {
    return direction > 0 ? [fullMinimum, fullMaximum] : [fullMaximum, fullMinimum];
  }
  let minimum = Math.min(start, stop);
  let maximum = Math.max(start, stop);
  if (minimum < fullMinimum) {
    maximum += fullMinimum - minimum;
    minimum = fullMinimum;
  }
  if (maximum > fullMaximum) {
    minimum -= maximum - fullMaximum;
    maximum = fullMaximum;
  }
  return direction > 0 ? [minimum, maximum] : [maximum, minimum];
}

export function resolvePlotViewTransform<Row>(
  scene: PlotScene<Row>,
  view: PlotView,
  axes: "x" | "y" | "xy" = "xy",
): string {
  const x = axes.includes("x")
    ? axisViewTransform(primaryScale(scene, "x"), view.x)
    : { scale: 1, translate: 0 };
  const y = axes.includes("y")
    ? axisViewTransform(primaryScale(scene, "y"), view.y)
    : { scale: 1, translate: 0 };
  return `matrix(${x.scale}, 0, 0, ${y.scale}, ${x.translate}, ${y.translate})`;
}

function axisViewTransform(
  scale: import("../scales").ResolvedScale | undefined,
  domain: PlotView["x"],
): { scale: number; translate: number } {
  if (!scale || !domain) return { scale: 1, translate: 0 };
  const sourceStart = scale.map(domain[0]);
  const sourceStop = scale.map(domain[1]);
  const targetStart = scale.range[0];
  const targetStop = scale.range[scale.range.length - 1];
  if (
    typeof sourceStart !== "number" ||
    typeof sourceStop !== "number" ||
    typeof targetStart !== "number" ||
    typeof targetStop !== "number" ||
    sourceStop === sourceStart
  ) {
    return { scale: 1, translate: 0 };
  }
  const scaleFactor = (targetStop - targetStart) / (sourceStop - sourceStart);
  return {
    scale: scaleFactor,
    translate: targetStart - sourceStart * scaleFactor,
  };
}

export function applyCanvasViewTransform<Row>(
  state: ControllerState<Row>,
  view: PlotView,
  axes: "x" | "y" | "xy",
): void {
  const x = axes.includes("x")
    ? axisViewTransform(primaryScale(state.scene, "x"), view.x)
    : { scale: 1, translate: 0 };
  const y = axes.includes("y")
    ? axisViewTransform(primaryScale(state.scene, "y"), view.y)
    : { scale: 1, translate: 0 };
  state.marksCanvas.style.transformOrigin = "0 0";
  state.marksCanvas.style.transform = `matrix(${x.scale}, 0, 0, ${y.scale}, ${x.translate}, ${y.translate})`;
  state.marksCanvas.style.willChange = "transform";
  const hits = transformHitRegions(state.scene.hits, {
    scaleX: x.scale,
    scaleY: y.scale,
    translateX: x.translate,
    translateY: y.translate,
  });
  state.hitIndex = createHitIndex(hits, { width: state.scene.width, height: state.scene.height });
  paintTransientChrome(state, x, y);
}

function paintTransientChrome<Row>(
  state: ControllerState<Row>,
  x: { scale: number; translate: number },
  y: { scale: number; translate: number },
): void {
  const axes = state.scene.axes.map((axis) => {
    const horizontal = axis.orientation === "top" || axis.orientation === "bottom";
    const transform = horizontal ? x : y;
    return {
      ...axis,
      ticks: axis.ticks.map((tick) => ({
        ...tick,
        position: tick.position * transform.scale + transform.translate,
      })),
    };
  });
  const grids = state.scene.grids.map((grid) => {
    const transform = grid.axis === "x" ? x : y;
    return {
      ...grid,
      positions: grid.positions.map((position) => position * transform.scale + transform.translate),
    };
  });
  const context = state.chromeCanvas.getContext("2d");
  if (context) renderPlotChrome(context, { ...state.scene, axes, grids }, state.theme);
}

export function clearCanvasTransform<Row>(state: ControllerState<Row>): void {
  state.marksCanvas.style.removeProperty("transform");
  state.marksCanvas.style.removeProperty("transform-origin");
  state.marksCanvas.style.removeProperty("will-change");
  state.hitIndex = createHitIndex(state.scene.hits, {
    width: state.scene.width,
    height: state.scene.height,
  });
}

export function scheduleTransientViewCommit<Row>(state: ControllerState<Row>): void {
  if (state.viewCommitTimer != null) clearTimeout(state.viewCommitTimer);
  state.viewCommitTimer = setTimeout(() => commitTransientView(state), 90);
}

export function commitTransientView<Row>(state: ControllerState<Row>): void {
  if (state.viewCommitTimer != null) clearTimeout(state.viewCommitTimer);
  state.viewCommitTimer = null;
  state.compileDeferredForGesture = false;
  scheduleCompile(state);
}

export function flushDeferredGestureCompile<Row>(state: ControllerState<Row>): void {
  if (!state.compileDeferredForGesture || gestureIsActive(state)) return;
  state.compileDeferredForGesture = false;
  scheduleCompile(state);
}

export function gestureIsActive<Row>(state: ControllerState<Row>): boolean {
  return state.transientView !== null || state.drag !== null || state.pointers.size > 0;
}

function domainPair(domain: readonly import("../scales").ScaleInput[] | undefined) {
  if (!domain || domain.length < 2) return undefined;
  const first = domain[0];
  const last = domain[domain.length - 1];
  return validViewValue(first) && validViewValue(last) ? ([first, last] as const) : undefined;
}

function validViewValue(value: unknown): value is ScaleValue {
  return typeof value === "string" || typeof value === "number" || value instanceof Date;
}

function numericValue(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function restoreValue(example: ScaleValue, value: number): ScaleValue {
  return example instanceof Date ? new Date(value) : value;
}

export function brushBounds<Row>(drag: DragState, axis: "x" | "y" | "xy", scene: PlotScene<Row>) {
  return {
    x0: axis === "y" ? scene.plotArea.x : drag.startX,
    x1: axis === "y" ? scene.plotArea.x + scene.plotArea.width : drag.currentX,
    y0: axis === "x" ? scene.plotArea.y : drag.startY,
    y1: axis === "x" ? scene.plotArea.y + scene.plotArea.height : drag.currentY,
  };
}

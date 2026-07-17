import { compilePlotScene } from "./compiler";
import type { PlotDescriptor } from "./descriptors";
import { serializePlotData, serializePlotSvg } from "./export";
import { createHitIndex, type HitIndex } from "./hit-index";
import type {
  FollowLatest,
  PlotApi,
  PlotApiRef,
  PlotDataExportOptions,
  PlotKey,
  PlotPngExportOptions,
  PlotRowKey,
  PlotSelection,
  PlotSvgExportOptions,
  PlotView,
  RootProps,
  ScaleValue,
} from "./model";
import {
  renderInteractionOverlay,
  renderPlotScene,
  resizeCanvas,
  resolvePlotTheme,
  type PlotInteractionOverlayState,
  type PlotTheme,
} from "./render";
import { trimPlotRows } from "./rows";
import type { HitRegion, PlotScene } from "./scene-model";
import {
  interpolateSceneMarks,
  resolveSceneTransitionMode,
  type SceneTransitionMode,
} from "./transitions";

export interface PlotRuntimeConfig<Row> {
  readonly sourceRows: readonly Row[];
  readonly descriptors: readonly PlotDescriptor[];
  readonly props: RootProps<Row>;
  readonly initialScene?: PlotScene<Row>;
  /** Internal immutable handoff used when Askr replaces a reactive Root frame. */
  readonly transitionFromScene?: PlotScene<Row>;
  readonly runtimeSnapshot?: PlotRuntimeSnapshot<Row>;
}

export interface PlotRuntimeSnapshot<Row> {
  readonly scene: PlotScene<Row>;
  readonly internalView: PlotView | undefined;
  readonly internalSelection: readonly PlotKey[];
  readonly hiddenSeries: readonly string[];
  readonly focusedKey: PlotKey | null;
  readonly followPaused: boolean;
  readonly frozenFollowRows: readonly Row[] | null;
  readonly fullView: PlotView;
}

export interface PlotController<Row> {
  update(config: PlotRuntimeConfig<Row>): void;
  destroy(): void;
  toggleSeries(series: string): void;
  resetView(): void;
  resumeLive(): void;
  readonly scene: PlotScene<Row>;
  readonly runtimeSnapshot: PlotRuntimeSnapshot<Row>;
}

interface DragState {
  readonly mode: "pan" | "brush";
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startView: PlotView;
  moved: boolean;
  currentX: number;
  currentY: number;
}

interface ControllerState<Row> {
  host: HTMLElement;
  baseCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  tooltip: HTMLElement | null;
  liveStatus: HTMLElement | null;
  config: PlotRuntimeConfig<Row>;
  scene: PlotScene<Row>;
  hitIndex: HitIndex<Row>;
  theme: PlotTheme;
  internalView: PlotView | undefined;
  internalSelection: Set<PlotKey>;
  hiddenSeries: Set<string>;
  focusIndex: number;
  focusKeyToRestore: PlotKey | null;
  hover: HitRegion<Row> | null;
  drag: DragState | null;
  pointers: Map<number, { x: number; y: number }>;
  pinchDistance: number | null;
  followPaused: boolean;
  frozenFollowRows: readonly Row[] | null;
  fullView: PlotView;
  transientView: PlotView | null;
  viewCommitTimer: ReturnType<typeof setTimeout> | null;
  suppressClick: boolean;
  destroyed: boolean;
  compileQueued: boolean;
  compileDeferredForGesture: boolean;
  frameHandle: number | null;
  pendingDataTransition: boolean;
  hasPaintedScene: boolean;
  transitionScene: PlotScene<Row> | null;
  transitionFrameHandle: number | null;
  canvasAnimation: Animation | null;
  currentApiRef: PlotApiRef<Row> | undefined;
  api: PlotApi<Row>;
  cleanups: Array<() => void>;
}

export function createPlotController<Row>(
  host: HTMLElement,
  config: PlotRuntimeConfig<Row>,
): PlotController<Row> {
  const baseCanvas = requireCanvas(host, "plot-canvas-base");
  const overlayCanvas = requireCanvas(host, "plot-canvas-overlay");
  const initialWidth = measureWidth(host, config.props.width);
  const initialHeight = measureHeight(host, config.props.height);
  const runtimeSnapshot = config.runtimeSnapshot;
  const snapshotRows = runtimeSnapshot?.followPaused
    ? (runtimeSnapshot.frozenFollowRows ?? runtimeSnapshot.scene.sourceRows)
    : undefined;
  const snapshotView =
    runtimeSnapshot && config.props.view === undefined ? runtimeSnapshot.internalView : undefined;
  const canReuseInitialScene =
    snapshotRows === undefined &&
    snapshotView === undefined &&
    config.initialScene !== undefined &&
    Math.abs(config.initialScene.width - initialWidth) <= 1 &&
    Math.abs(config.initialScene.height - initialHeight) <= 1;
  const initialScene = canReuseInitialScene
    ? config.initialScene!
    : compileRuntimeScene(
        config,
        initialWidth,
        initialHeight,
        snapshotRows,
        config.props.view ?? snapshotView ?? config.props.defaultView,
      );
  const state = {} as ControllerState<Row>;
  const api = createApi(state);
  Object.assign(state, {
    host,
    baseCanvas,
    overlayCanvas,
    tooltip: host.querySelector('[data-slot="plot-tooltip"]'),
    liveStatus:
      host
        .closest<HTMLElement>('[data-slot="plot-root"]')
        ?.querySelector('[data-slot="plot-live-status"]') ?? null,
    config,
    scene: initialScene,
    hitIndex: createHitIndex([], {
      width: initialScene.width,
      height: initialScene.height,
    }),
    theme: resolvePlotTheme(host),
    internalView: runtimeSnapshot?.internalView ?? config.props.defaultView,
    internalSelection: new Set(
      runtimeSnapshot?.internalSelection ?? config.props.defaultSelection?.keys ?? [],
    ),
    hiddenSeries: new Set<string>(runtimeSnapshot?.hiddenSeries ?? []),
    focusIndex: -1,
    focusKeyToRestore: runtimeSnapshot?.focusedKey ?? null,
    hover: null,
    drag: null,
    pointers: new Map<number, { x: number; y: number }>(),
    pinchDistance: null,
    followPaused: runtimeSnapshot?.followPaused ?? false,
    frozenFollowRows: runtimeSnapshot?.frozenFollowRows ?? null,
    fullView: runtimeSnapshot?.fullView ?? currentDomainView(initialScene),
    transientView: null,
    viewCommitTimer: null,
    suppressClick: false,
    destroyed: false,
    compileQueued: false,
    compileDeferredForGesture: false,
    frameHandle: null,
    pendingDataTransition: false,
    hasPaintedScene: config.transitionFromScene !== undefined,
    transitionScene: null,
    transitionFrameHandle: null,
    canvasAnimation: null,
    currentApiRef: config.props.apiRef,
    api,
    cleanups: [],
  } satisfies Partial<ControllerState<Row>>);

  bindController(state);
  assignApiRef(state.currentApiRef, state.api);
  installSceneAndPaint(
    state,
    initialScene,
    initialWidth,
    initialHeight,
    config.transitionFromScene !== undefined,
    config.transitionFromScene,
  );

  return Object.freeze({
    update(nextConfig: PlotRuntimeConfig<Row>) {
      if (state.destroyed) return;
      const previousRef = state.currentApiRef;
      state.pendingDataTransition ||= state.config.sourceRows !== nextConfig.sourceRows;
      state.config = nextConfig;
      state.currentApiRef = nextConfig.props.apiRef;
      if (previousRef !== state.currentApiRef) {
        assignApiRef(previousRef, null);
        assignApiRef(state.currentApiRef, state.api);
      }
      if (state.internalSelection.size > 0 || (nextConfig.props.selection?.keys.length ?? 0) > 0) {
        retainSelection(state);
      }
      if (gestureIsActive(state)) state.compileDeferredForGesture = true;
      else scheduleCompile(state);
    },
    destroy() {
      destroyController(state);
    },
    toggleSeries(series: string) {
      if (state.hiddenSeries.has(series)) state.hiddenSeries.delete(series);
      else state.hiddenSeries.add(series);
      updateLegendButtons(state);
      paintBase(state);
    },
    resetView() {
      resetView(state);
    },
    resumeLive() {
      resumeLive(state);
    },
    get scene() {
      return state.scene;
    },
    get runtimeSnapshot() {
      return snapshotRuntime(state);
    },
  });
}

function createApi<Row>(state: ControllerState<Row>): PlotApi<Row> {
  return Object.freeze({
    resetView() {
      resetView(state);
    },
    resumeLive() {
      resumeLive(state);
    },
    async exportPng(options?: PlotPngExportOptions) {
      return exportPng(state, options);
    },
    exportSvg(options?: PlotSvgExportOptions) {
      const scene = exportScene(state, options?.view);
      return serializePlotSvg(scene, {
        ...options,
        theme: state.theme,
        hiddenSeries: state.hiddenSeries,
        selectedKeys: selectionKeys(state),
        overlays: options?.includeOverlays ? interactionOverlayState(state) : undefined,
      });
    },
    exportData(options?: PlotDataExportOptions) {
      return exportData(state, options);
    },
    get rows() {
      return state.config.sourceRows;
    },
  });
}

function bindController<Row>(state: ControllerState<Row>): void {
  const overlay = state.overlayCanvas;
  listen(state, overlay, "pointermove", (event) => onPointerMove(state, event as PointerEvent));
  listen(state, overlay, "pointerdown", (event) => onPointerDown(state, event as PointerEvent));
  listen(state, overlay, "pointerup", (event) => onPointerUp(state, event as PointerEvent));
  listen(state, overlay, "pointercancel", (event) => onPointerCancel(state, event as PointerEvent));
  listen(state, overlay, "pointerleave", (event) => onPointerLeave(state, event as PointerEvent));
  listen(state, overlay, "click", (event) => onClick(state, event as MouseEvent));
  listen(state, state.host, "keydown", (event) => onKeyDown(state, event as KeyboardEvent));
  const wheel = (event: WheelEvent) => onWheel(state, event);
  overlay.addEventListener("wheel", wheel, { passive: false });
  state.cleanups.push(() => overlay.removeEventListener("wheel", wheel));

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      const width = measureWidth(state.host, state.config.props.width);
      const height = measureHeight(state.host, state.config.props.height);
      if (Math.abs(state.scene.width - width) > 1 || Math.abs(state.scene.height - height) > 1) {
        scheduleCompile(state);
      }
    });
    observer.observe(state.host);
    state.cleanups.push(() => observer.disconnect());
  } else if (typeof window !== "undefined") {
    const resize = () => scheduleCompile(state);
    window.addEventListener("resize", resize);
    state.cleanups.push(() => window.removeEventListener("resize", resize));
  }

  if (typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(() => {
      state.theme = resolvePlotTheme(state.host);
      paintBase(state);
      paintOverlay(state);
    });
    observer.observe(state.host, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    let ancestor = state.host.parentElement;
    while (ancestor) {
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme"],
      });
      ancestor = ancestor.parentElement;
    }
    if (typeof document !== "undefined") {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme"],
      });
    }
    state.cleanups.push(() => observer.disconnect());
  }

  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (fonts?.ready) {
    let active = true;
    void fonts.ready.then(() => {
      if (active && !state.destroyed) {
        state.theme = resolvePlotTheme(state.host);
        if (!sceneTransitionIsActive(state)) paintBase(state);
      }
    });
    state.cleanups.push(() => {
      active = false;
    });
  }

  if (typeof matchMedia === "function") {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      state.host.setAttribute("data-reduced-motion", media.matches ? "true" : "false");
      if (media.matches && state.hasPaintedScene) {
        cancelSceneTransition(state);
        setTransitionMode(state, "none");
        paintBaseScene(state, state.scene);
      }
    };
    update();
    media.addEventListener?.("change", update);
    state.cleanups.push(() => media.removeEventListener?.("change", update));
  }
}

function compileAndPaint<Row>(state: ControllerState<Row>): void {
  if (state.destroyed) return;
  state.compileQueued = false;
  state.frameHandle = null;
  const width = measureWidth(state.host, state.config.props.width);
  const height = measureHeight(state.host, state.config.props.height);
  const view = state.config.props.view ?? state.internalView;
  const animateDataUpdate = state.pendingDataTransition;
  state.pendingDataTransition = false;
  const scene = compileRuntimeScene(
    state.config,
    width,
    height,
    state.followPaused ? (state.frozenFollowRows ?? state.scene.sourceRows) : undefined,
    view,
  );
  // Full bounds are data-derived metadata, not persisted render state. Rebuild
  // them from the current source snapshot so append/reset flows can reach new
  // extrema after an earlier zoom.
  const fullScene = compileRuntimeScene(
    state.config,
    width,
    height,
    state.followPaused ? (state.frozenFollowRows ?? state.scene.sourceRows) : undefined,
    undefined,
  );
  state.fullView = currentDomainView(fullScene);
  installSceneAndPaint(state, scene, width, height, animateDataUpdate);
}

function installSceneAndPaint<Row>(
  state: ControllerState<Row>,
  scene: PlotScene<Row>,
  width: number,
  height: number,
  animateDataUpdate = false,
  previousSceneOverride?: PlotScene<Row>,
): void {
  const previousPaintedScene = previousSceneOverride ?? state.transitionScene ?? state.scene;
  const focusedKey =
    state.focusKeyToRestore ??
    (state.focusIndex >= 0 ? (filteredHits(state)[state.focusIndex]?.key ?? null) : null);
  cancelSceneTransition(state);
  state.scene = scene;
  state.hitIndex = createHitIndex(scene.hits, { width, height });
  state.focusIndex =
    focusedKey == null ? -1 : filteredHits(state).findIndex((hit) => hit.key === focusedKey);
  state.focusKeyToRestore = null;
  if (state.internalSelection.size > 0 || (state.config.props.selection?.keys.length ?? 0) > 0) {
    retainSelection(state);
  }
  state.theme = resolvePlotTheme(state.host);
  const ratio = devicePixelRatioValue();
  resizeCanvas(state.baseCanvas, width, height, ratio);
  resizeCanvas(state.overlayCanvas, width, height, ratio);
  state.scene = Object.freeze({ ...state.scene, pixelRatio: ratio });
  if (state.config.props.view === undefined && state.internalView === undefined) {
    state.fullView = currentDomainView(state.scene);
  }
  if (state.viewCommitTimer != null) clearTimeout(state.viewCommitTimer);
  state.viewCommitTimer = null;
  state.transientView = null;
  clearCanvasTransform(state);
  state.host.setAttribute("data-mark-count", String(state.scene.marks.length));
  const transitionMode =
    animateDataUpdate && state.hasPaintedScene
      ? resolveSceneTransitionMode(
          previousPaintedScene.marks,
          state.scene.marks,
          state.hiddenSeries,
          prefersReducedMotion(state),
        )
      : "none";
  state.hasPaintedScene = true;
  setTransitionMode(state, transitionMode);
  if (transitionMode === "keyed") {
    startKeyedSceneTransition(state, previousPaintedScene, state.scene);
  } else {
    paintBaseScene(state, state.scene);
    if (transitionMode === "single") startWholeCanvasTransition(state);
  }
  paintOverlay(state);
  if (state.hiddenSeries.size > 0) updateLegendButtons(state);
  updateLiveStatus(state);
  const development = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  if ((state.config.props.diagnostics ?? development) && state.scene.diagnostics.length > 0) {
    for (const diagnostic of state.scene.diagnostics) {
      console.warn(`[Askr charts] ${diagnostic.message}`);
    }
  }
}

function compileRuntimeScene<Row>(
  config: PlotRuntimeConfig<Row>,
  width: number,
  height: number,
  rowOverride: readonly Row[] | undefined,
  view: PlotView | undefined,
): PlotScene<Row> {
  const rows = rowOverride ?? applyFollowLatest(config.sourceRows, config.props.followLatest);
  return compilePlotScene({
    rows,
    rowKey: config.props.rowKey,
    label: config.props.label,
    descriptors: config.descriptors,
    width,
    height,
    pixelRatio: devicePixelRatioValue(),
    view,
    summary: config.props.summary,
    locale: config.props.locale,
  });
}

function applyFollowLatest<Row>(
  rows: readonly Row[],
  follow: FollowLatest<Row> | undefined,
): readonly Row[] {
  if (follow == null) return rows;
  if (typeof follow === "number") return trimPlotRows(rows, follow);
  if ("rows" in follow) return trimPlotRows(rows, follow.rows);
  return trimPlotRows(rows, {
    durationMs: follow.durationMs,
    field: follow.field,
  });
}

function paintBase<Row>(state: ControllerState<Row>): void {
  cancelSceneTransition(state);
  setTransitionMode(state, "none");
  paintBaseScene(state, state.scene);
}

function paintBaseScene<Row>(state: ControllerState<Row>, scene: PlotScene<Row>): void {
  const context = state.baseCanvas.getContext("2d");
  if (!context) return;
  renderPlotScene(context, scene, state.theme, {
    hiddenSeries: state.hiddenSeries,
    selectedKeys: selectionKeys(state),
  });
}

function startKeyedSceneTransition<Row>(
  state: ControllerState<Row>,
  previous: PlotScene<Row>,
  next: PlotScene<Row>,
): void {
  if (typeof requestAnimationFrame !== "function") {
    setTransitionMode(state, "none");
    paintBaseScene(state, next);
    return;
  }

  const duration = transitionDurationMs(state.host);
  if (duration <= 0) {
    setTransitionMode(state, "none");
    paintBaseScene(state, next);
    return;
  }

  const startedAt = animationNow();
  const previousMarks = visibleTransitionMarks(previous.marks, state.hiddenSeries);
  const nextMarks = visibleTransitionMarks(next.marks, state.hiddenSeries);
  state.host.setAttribute("data-animation-running", "true");
  paintKeyedTransitionFrame(state, next, previousMarks, nextMarks, 0);

  const step = (timestamp: number) => {
    if (state.destroyed) return;
    const linearProgress = Math.max(0, Math.min(1, (timestamp - startedAt) / duration));
    const easedProgress = 1 - Math.pow(1 - linearProgress, 3);
    paintKeyedTransitionFrame(
      state,
      next,
      previousMarks,
      nextMarks,
      easedProgress,
    );
    if (linearProgress < 1) {
      state.transitionFrameHandle = requestAnimationFrame(step);
      return;
    }
    state.transitionFrameHandle = null;
    state.transitionScene = null;
    state.host.removeAttribute("data-animation-running");
  };
  state.transitionFrameHandle = requestAnimationFrame(step);
}

function paintKeyedTransitionFrame<Row>(
  state: ControllerState<Row>,
  next: PlotScene<Row>,
  previousMarks: PlotScene<Row>["marks"],
  nextMarks: PlotScene<Row>["marks"],
  progress: number,
): void {
  const frameScene = {
    ...next,
    marks: interpolateSceneMarks(previousMarks, nextMarks, progress),
  } as PlotScene<Row>;
  state.transitionScene = frameScene;
  paintBaseScene(state, frameScene);
}

function visibleTransitionMarks<Row>(
  marks: PlotScene<Row>["marks"],
  hiddenSeries: ReadonlySet<string>,
): PlotScene<Row>["marks"] {
  if (hiddenSeries.size === 0) return marks;
  return marks.filter((mark) => !mark.series || !hiddenSeries.has(mark.series));
}

function startWholeCanvasTransition<Row>(state: ControllerState<Row>): void {
  const duration = transitionDurationMs(state.host);
  const animate = state.baseCanvas.animate;
  if (duration <= 0 || typeof animate !== "function") {
    setTransitionMode(state, "none");
    return;
  }
  const animation = animate.call(state.baseCanvas, [{ opacity: 0.72 }, { opacity: 1 }], {
    duration,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  });
  state.canvasAnimation = animation;
  state.host.setAttribute("data-animation-running", "true");
  void animation.finished
    .then(() => {
      if (state.canvasAnimation !== animation) return;
      state.canvasAnimation = null;
      state.host.removeAttribute("data-animation-running");
    })
    .catch(() => {
      // Cancellation is expected when another update, repaint, or cleanup wins.
    });
}

function cancelSceneTransition<Row>(state: ControllerState<Row>): void {
  if (state.transitionFrameHandle != null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(state.transitionFrameHandle);
  }
  state.transitionFrameHandle = null;
  state.transitionScene = null;
  if (state.canvasAnimation) state.canvasAnimation.cancel();
  state.canvasAnimation = null;
  state.host.removeAttribute("data-animation-running");
}

function sceneTransitionIsActive<Row>(state: ControllerState<Row>): boolean {
  return state.transitionFrameHandle != null || state.canvasAnimation != null;
}

function setTransitionMode<Row>(state: ControllerState<Row>, mode: SceneTransitionMode): void {
  state.host.setAttribute("data-animation-mode", mode);
}

function prefersReducedMotion<Row>(state: ControllerState<Row>): boolean {
  if (state.host.getAttribute("data-reduced-motion") === "true") return true;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function transitionDurationMs(element: Element): number {
  if (typeof getComputedStyle !== "function") return 160;
  const value = getComputedStyle(element).getPropertyValue("--ak-chart-transition-duration").trim();
  if (value.endsWith("ms")) return Math.max(0, Number.parseFloat(value) || 0);
  if (value.endsWith("s")) return Math.max(0, (Number.parseFloat(value) || 0) * 1_000);
  return 160;
}

function animationNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function paintOverlay<Row>(state: ControllerState<Row>): void {
  const context = state.overlayCanvas.getContext("2d");
  if (!context) return;
  renderInteractionOverlay(context, state.scene, state.theme, interactionOverlayState(state));
}

function interactionOverlayState<Row>(state: ControllerState<Row>): PlotInteractionOverlayState {
  const crosshair =
    state.hover && state.scene.interactions.crosshair
      ? {
          ...hitCenter(state.hover),
          axes: state.scene.interactions.crosshair,
        }
      : null;
  const brush =
    state.drag?.mode === "brush"
      ? {
          x0: state.drag.startX,
          y0: state.drag.startY,
          x1: state.drag.currentX,
          y1: state.drag.currentY,
        }
      : null;
  const focused = filteredHits(state)[state.focusIndex];
  return {
    crosshair,
    brush,
    focus: focused ? { ...hitCenter(focused), radius: 6 } : null,
  };
}

function onPointerMove<Row>(state: ControllerState<Row>, event: PointerEvent): void {
  const point = eventPoint(state.overlayCanvas, event);
  // Only pointerdown registers an active gesture pointer. Hover moves must not
  // linger in this map or the next drag is incorrectly interpreted as a pinch.
  if (state.pointers.has(event.pointerId)) state.pointers.set(event.pointerId, point);
  if (state.pointers.size >= 2 && state.scene.interactions.zoom?.pinch && hasContinuousZoomAxis(state)) {
    const [first, second] = [...state.pointers.values()];
    if (first && second) {
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (state.pinchDistance && distance > 0) {
        zoomAt(
          state,
          (first.x + second.x) / 2,
          (first.y + second.y) / 2,
          state.pinchDistance / distance,
          false,
        );
      }
      state.pinchDistance = distance;
    }
    return;
  }

  if (state.drag) {
    state.drag.currentX = point.x;
    state.drag.currentY = point.y;
    state.drag.moved ||= Math.hypot(point.x - state.drag.startX, point.y - state.drag.startY) > 3;
    if (state.drag.mode === "pan" && state.drag.moved) {
      panTo(state, state.drag, point.x, point.y);
    } else {
      paintOverlay(state);
    }
    return;
  }

  state.hover = queryVisibleHit(state, point.x, point.y);
  updateTooltip(state, point.x, point.y);
  paintOverlay(state);
}

function onPointerDown<Row>(state: ControllerState<Row>, event: PointerEvent): void {
  const point = eventPoint(state.overlayCanvas, event);
  state.suppressClick = false;
  state.pointers.set(event.pointerId, point);
  try {
    state.overlayCanvas.setPointerCapture?.(event.pointerId);
  } catch {
    // Synthetic events and pointers that have already ended cannot be captured.
    // Canvas-local events still provide enough information to track the gesture.
  }
  if (state.pointers.size >= 2 && state.scene.interactions.zoom?.pinch && hasContinuousZoomAxis(state)) {
    const [first, second] = [...state.pointers.values()];
    state.suppressClick ||= state.drag?.moved ?? false;
    state.drag = null;
    state.host.closest<HTMLElement>('[data-slot="plot-root"]')?.removeAttribute("data-panning");
    state.pinchDistance =
      first && second ? Math.hypot(second.x - first.x, second.y - first.y) : null;
    return;
  }
  const brush = state.scene.interactions.brush;
  const wantsBrush = brush && (brush.modifier === "none" || event.shiftKey);
  if (wantsBrush) {
    state.drag = {
      mode: "brush",
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      startView: currentDomainView(state.scene),
      moved: false,
    };
  } else if (state.scene.interactions.zoom?.pan && event.button === 0 && hasContinuousZoomAxis(state)) {
    state.drag = {
      mode: "pan",
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      startView: currentDomainView(state.scene),
      moved: false,
    };
    state.host
      .closest<HTMLElement>('[data-slot="plot-root"]')
      ?.setAttribute("data-panning", "true");
  }
}

function onPointerUp<Row>(state: ControllerState<Row>, event: PointerEvent): void {
  const point = eventPoint(state.overlayCanvas, event);
  state.pointers.delete(event.pointerId);
  try {
    state.overlayCanvas.releasePointerCapture?.(event.pointerId);
  } catch {
    // The browser may already have released capture before pointerup dispatch.
  }
  state.pinchDistance = state.pointers.size >= 2 ? state.pinchDistance : null;
  if (!state.drag || state.drag.pointerId !== event.pointerId) {
    if (state.pointers.size === 0 && state.transientView) commitTransientView(state);
    else flushDeferredGestureCompile(state);
    return;
  }
  const drag = state.drag;
  drag.currentX = point.x;
  drag.currentY = point.y;
  if (drag.mode === "brush" && drag.moved) {
    const brush = state.scene.interactions.brush;
    const bounds = brushBounds(drag, brush?.axis ?? "xy", state.scene);
    const keys = new Set(
      state.hitIndex
        .queryRect(bounds.x0, bounds.y0, bounds.x1, bounds.y1)
        .filter((hit) => !hit.series || !state.hiddenSeries.has(hit.series))
        .flatMap((hit) => {
          const record = state.scene.transformedRows.find((candidate) => candidate.key === hit.key);
          return record?.sourceKeys ?? [hit.key];
        }),
    );
    setSelection(state, keys);
  }
  if (drag.moved) state.suppressClick = true;
  if (drag.mode === "pan" && drag.moved) commitTransientView(state);
  state.drag = null;
  state.host.closest<HTMLElement>('[data-slot="plot-root"]')?.removeAttribute("data-panning");
  paintOverlay(state);
  flushDeferredGestureCompile(state);
}

function onPointerCancel<Row>(state: ControllerState<Row>, event: PointerEvent): void {
  state.pointers.delete(event.pointerId);
  state.pinchDistance = null;
  if (state.drag?.pointerId === event.pointerId) {
    state.suppressClick = state.drag.moved;
    if (state.drag.mode === "pan" && state.transientView) commitTransientView(state);
    state.drag = null;
  } else if (state.pointers.size === 0 && state.transientView) {
    commitTransientView(state);
  }
  state.host.closest<HTMLElement>('[data-slot="plot-root"]')?.removeAttribute("data-panning");
  paintOverlay(state);
  flushDeferredGestureCompile(state);
}

function onPointerLeave<Row>(state: ControllerState<Row>, event: PointerEvent): void {
  state.pointers.delete(event.pointerId);
  if (state.pointers.size === 0) {
    state.host.closest<HTMLElement>('[data-slot="plot-root"]')?.removeAttribute("data-panning");
    if (state.transientView) commitTransientView(state);
  }
  if (!state.drag) {
    state.hover = null;
    hideTooltip(state);
    paintOverlay(state);
  }
}

function onWheel<Row>(state: ControllerState<Row>, event: WheelEvent): void {
  if (!state.scene.interactions.zoom?.wheel || !hasContinuousZoomAxis(state)) return;
  event.preventDefault();
  const point = eventPoint(state.overlayCanvas, event);
  const factor = Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.002)));
  zoomAt(state, point.x, point.y, factor, true);
}

function hasContinuousZoomAxis<Row>(state: ControllerState<Row>): boolean {
  const axes = state.scene.interactions.zoom?.axes ?? "xy";
  return (
    (axes.includes("x") && isContinuousScale(primaryScale(state.scene, "x"))) ||
    (axes.includes("y") && isContinuousScale(primaryScale(state.scene, "y")))
  );
}

function isContinuousScale(scale: import("./scales").ResolvedScale | undefined): boolean {
  return scale != null && ["linear", "power", "log", "symlog", "time", "utc"].includes(scale.type);
}

function axisScaleNames<Row>(scene: PlotScene<Row>, axis: "x" | "y"): readonly string[] {
  const names = new Set<string>();
  const primary = primaryScale(scene, axis);
  if (primary) names.add(primary.name);
  for (const candidate of scene.axes) {
    const horizontal = candidate.orientation === "top" || candidate.orientation === "bottom";
    if ((axis === "x") === horizontal) names.add(candidate.scale);
  }
  return [...names];
}

function onClick<Row>(state: ControllerState<Row>, event: MouseEvent): void {
  if (state.suppressClick) {
    state.suppressClick = false;
    return;
  }
  const point = eventPoint(state.overlayCanvas, event);
  const hit = queryVisibleHit(state, point.x, point.y);
  if (hit) state.config.props.onActivate?.(hit.row, hit.key);
}

function onKeyDown<Row>(state: ControllerState<Row>, event: KeyboardEvent): void {
  const hits = filteredHits(state);
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    state.focusIndex = hits.length === 0 ? -1 : (state.focusIndex + 1 + hits.length) % hits.length;
    announceFocusedHit(state, hits[state.focusIndex] ?? null);
    paintOverlay(state);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    state.focusIndex = hits.length === 0 ? -1 : (state.focusIndex - 1 + hits.length) % hits.length;
    announceFocusedHit(state, hits[state.focusIndex] ?? null);
    paintOverlay(state);
  } else if (event.key === "Enter" || event.key === " ") {
    const hit = hits[state.focusIndex];
    if (hit) {
      event.preventDefault();
      state.config.props.onActivate?.(hit.row, hit.key);
    }
  } else if (event.key === "Escape") {
    state.focusIndex = -1;
    state.hover = null;
    hideTooltip(state);
    paintOverlay(state);
  } else if (event.key === "Home") {
    resetView(state);
  }
}

function zoomAt<Row>(
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
      const full = state.fullView.scales?.[name] ?? (axis === "x" ? state.fullView.x : state.fullView.y);
      const updated = zoomScale(scale, domain, full, axis === "x" ? x : y, factor, interaction.min, interaction.max);
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
  scale: import("./scales").ResolvedScale | undefined,
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
  const center = start + (stop - start) * fraction;
  const fullStart = numericValue(fullDomain?.[0]);
  const fullStop = numericValue(fullDomain?.[1]);
  const fullSpan =
    fullStart == null || fullStop == null ? Math.abs(stop - start) : Math.abs(fullStop - fullStart);
  const lowerSpan = fullSpan / Math.max(1, maximumZoom);
  const upperSpan = fullSpan / Math.max(1, minimumZoom);
  const span = Math.max(lowerSpan, Math.min(upperSpan, Math.abs(stop - start) * factor));
  const direction = stop >= start ? 1 : -1;
  const nextStart = center - direction * span * fraction;
  const nextStop = nextStart + direction * span;
  const bounded = clampViewDomain(nextStart, nextStop, fullStart, fullStop);
  return [restoreValue(domain[0], bounded[0]), restoreValue(domain[1], bounded[1])];
}

function panTo<Row>(state: ControllerState<Row>, drag: DragState, x: number, y: number): void {
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
      const domain = drag.startView.scales?.[name] ?? (axis === "x" ? drag.startView.x : drag.startView.y);
      const full = state.fullView.scales?.[name] ?? (axis === "x" ? state.fullView.x : state.fullView.y);
      const updated = panScale(scale, domain, full, axis === "x" ? drag.startX : drag.startY, axis === "x" ? x : y);
      if (updated) scales[name] = updated;
      if (name === primaryScale(state.scene, axis)?.name) next[axis] = updated;
    }
  }
  next.scales = scales;
  setView(state, next, false);
  applyCanvasViewTransform(state, next, interaction.axes);
}

function panScale(
  scale: import("./scales").ResolvedScale | undefined,
  domain: PlotView["x"],
  fullDomain: PlotView["x"],
  startPixel: number,
  currentPixel: number,
): readonly [ScaleValue, ScaleValue] | undefined {
  if (!scale?.invert || !domain) return domain;
  const startValue = scale.invert(startPixel);
  const currentValue = scale.invert(currentPixel);
  const start = numericValue(startValue);
  const current = numericValue(currentValue);
  const domainStart = numericValue(domain[0]);
  const domainStop = numericValue(domain[1]);
  if (start == null || current == null || domainStart == null || domainStop == null) return domain;
  const delta = start - current;
  const bounded = clampViewDomain(
    domainStart + delta,
    domainStop + delta,
    numericValue(fullDomain?.[0]),
    numericValue(fullDomain?.[1]),
  );
  return [restoreValue(domain[0], bounded[0]), restoreValue(domain[1], bounded[1])];
}

function setView<Row>(state: ControllerState<Row>, view: PlotView | undefined, commit = true): void {
  state.config.props.onViewChange?.(view ?? {});
  if (state.config.props.view === undefined) state.internalView = view;
  state.transientView = commit ? null : (view ?? {});
  if (commit) scheduleCompile(state);
}

function resetView<Row>(state: ControllerState<Row>): void {
  state.followPaused = false;
  state.frozenFollowRows = null;
  const next = state.config.props.defaultView ?? {};
  setView(state, next);
}

function resumeLive<Row>(state: ControllerState<Row>): void {
  state.followPaused = false;
  state.frozenFollowRows = null;
  setView(state, state.config.props.defaultView ?? {});
  updateLiveStatus(state);
}

function pauseFollowing<Row>(state: ControllerState<Row>): void {
  if (!state.config.props.followLatest) return;
  if (!state.followPaused) state.frozenFollowRows = Object.freeze([...state.scene.sourceRows]);
  state.followPaused = true;
  updateLiveStatus(state);
}

function setSelection<Row>(state: ControllerState<Row>, keys: Set<PlotKey>): void {
  const selection: PlotSelection = Object.freeze({ keys: Object.freeze([...keys]) });
  state.config.props.onSelectionChange?.(selection);
  if (state.config.props.selection === undefined) state.internalSelection = keys;
  paintBase(state);
  paintOverlay(state);
}

function selectionKeys<Row>(state: ControllerState<Row>): ReadonlySet<PlotKey> {
  return state.config.props.selection
    ? new Set(state.config.props.selection.keys)
    : state.internalSelection;
}

function snapshotRuntime<Row>(state: ControllerState<Row>): PlotRuntimeSnapshot<Row> {
  const focusedKey =
    state.focusIndex >= 0 ? (filteredHits(state)[state.focusIndex]?.key ?? null) : null;
  return Object.freeze({
    scene: state.transitionScene ?? state.scene,
    internalView: copyPlotView(state.internalView),
    internalSelection: Object.freeze([...state.internalSelection]),
    hiddenSeries: Object.freeze([...state.hiddenSeries]),
    focusedKey,
    followPaused: state.followPaused,
    frozenFollowRows: state.frozenFollowRows ? Object.freeze([...state.frozenFollowRows]) : null,
    fullView: copyPlotView(state.fullView) ?? Object.freeze({}),
  });
}

function copyPlotView(view: PlotView | undefined): PlotView | undefined {
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

function retainSelection<Row>(state: ControllerState<Row>): void {
  const existing = new Set(
    state.config.sourceRows.map((row, index) => readKeySafe(row, index, state.config.props.rowKey)),
  );
  const controlled = state.config.props.selection?.keys;
  if (controlled) state.internalSelection = new Set(controlled.filter((key) => existing.has(key)));
  else
    state.internalSelection = new Set(
      [...state.internalSelection].filter((key) => existing.has(key)),
    );
}

function readKeySafe<Row>(row: Row, index: number, rowKey: PlotRowKey<Row>): PlotKey {
  const value =
    typeof rowKey === "function" ? rowKey(row, index) : (row as Record<string, unknown>)[rowKey];
  return typeof value === "string" || typeof value === "number" ? value : index;
}

function updateTooltip<Row>(state: ControllerState<Row>, x: number, y: number): void {
  const tooltip = state.tooltip;
  if (!tooltip || !state.scene.interactions.tooltip || !state.hover) {
    hideTooltip(state);
    return;
  }
  const channels = state.scene.interactions.tooltipChannels;
  const record = Object.fromEntries(
    Object.entries(state.hover.channels).filter(
      ([channel]) => channels == null || channels.includes(channel),
    ),
  );
  const formatted = state.scene.interactions.tooltipFormat?.(Object.freeze(record));
  tooltip.hidden = false;
  tooltip.dataset.open = "true";
  tooltip.setAttribute("aria-hidden", "false");
  tooltip.textContent =
    formatted ??
    (channels == null
      ? state.hover.title
      : Object.entries(record)
          .map(([channel, value]) => `${channel}: ${formatTooltipValue(value)}`)
          .join(", "));
  const frame = tooltip.offsetParent instanceof HTMLElement ? tooltip.offsetParent : state.host;
  const frameWidth = frame.clientWidth || state.scene.width;
  const frameHeight = frame.clientHeight || state.scene.height;
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  const left = Math.max(8, Math.min(frameWidth - tooltipWidth - 8, x - tooltipWidth / 2));
  const above = y - tooltipHeight - 8 >= 8;
  const top = above ? y - tooltipHeight - 8 : Math.min(frameHeight - tooltipHeight - 8, y + 8);
  tooltip.style.transform = "none";
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function announceFocusedHit<Row>(state: ControllerState<Row>, hit: HitRegion<Row> | null): void {
  state.hover = hit;
  if (!hit) {
    hideTooltip(state);
    return;
  }
  const center = hitCenter(hit);
  updateTooltip(state, center.x, center.y);
}

function hideTooltip<Row>(state: ControllerState<Row>): void {
  if (!state.tooltip) return;
  state.tooltip.hidden = true;
  state.tooltip.removeAttribute("data-open");
  state.tooltip.setAttribute("aria-hidden", "true");
}

function formatTooltipValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value == null) return "missing";
  if (typeof value === "number" && !Number.isFinite(value)) return "missing";
  return String(value);
}

function queryVisibleHit<Row>(
  state: ControllerState<Row>,
  x: number,
  y: number,
): HitRegion<Row> | null {
  return (
    state.hitIndex
      .queryAll(x, y)
      .find((hit) => !hit.series || !state.hiddenSeries.has(hit.series)) ?? null
  );
}

function filteredHits<Row>(state: ControllerState<Row>): readonly HitRegion<Row>[] {
  return state.scene.hits.filter((hit) => !hit.series || !state.hiddenSeries.has(hit.series));
}

function hitCenter<Row>(hit: HitRegion<Row>): { x: number; y: number } {
  const shape = hit.shape;
  if (shape.kind === "rect") return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
  if (shape.kind === "circle") return { x: shape.x, y: shape.y };
  if (shape.kind === "line") return { x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2 };
  const angle = (shape.startAngle + shape.endAngle) / 2;
  const radius = (shape.innerRadius + shape.outerRadius) / 2;
  return { x: shape.cx + Math.cos(angle) * radius, y: shape.cy + Math.sin(angle) * radius };
}

function currentDomainView<Row>(scene: PlotScene<Row>): PlotView {
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

function primaryScale<Row>(
  scene: PlotScene<Row>,
  axis: "x" | "y",
): import("./scales").ResolvedScale | undefined {
  const direct = scene.scales[axis];
  if (direct) return direct;
  const sceneAxis = scene.axes.find((candidate) =>
    axis === "x"
      ? candidate.orientation === "top" || candidate.orientation === "bottom"
      : candidate.orientation === "left" || candidate.orientation === "right",
  );
  return sceneAxis ? scene.scales[sceneAxis.scale] : undefined;
}

function clampViewDomain(
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
  scale: import("./scales").ResolvedScale | undefined,
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

function applyCanvasViewTransform<Row>(
  state: ControllerState<Row>,
  view: PlotView,
  axes: "x" | "y" | "xy",
): void {
  state.baseCanvas.style.transformOrigin = "0 0";
  state.baseCanvas.style.transform = resolvePlotViewTransform(state.scene, view, axes);
  state.baseCanvas.style.willChange = "transform";
}

function clearCanvasTransform<Row>(state: ControllerState<Row>): void {
  state.baseCanvas.style.removeProperty("transform");
  state.baseCanvas.style.removeProperty("transform-origin");
  state.baseCanvas.style.removeProperty("will-change");
}

function scheduleTransientViewCommit<Row>(state: ControllerState<Row>): void {
  if (state.viewCommitTimer != null) clearTimeout(state.viewCommitTimer);
  state.viewCommitTimer = setTimeout(() => commitTransientView(state), 90);
}

function commitTransientView<Row>(state: ControllerState<Row>): void {
  if (state.viewCommitTimer != null) clearTimeout(state.viewCommitTimer);
  state.viewCommitTimer = null;
  state.compileDeferredForGesture = false;
  scheduleCompile(state);
}

function flushDeferredGestureCompile<Row>(state: ControllerState<Row>): void {
  if (!state.compileDeferredForGesture || gestureIsActive(state)) return;
  state.compileDeferredForGesture = false;
  scheduleCompile(state);
}

function gestureIsActive<Row>(state: ControllerState<Row>): boolean {
  return state.transientView !== null || state.drag !== null || state.pointers.size > 0;
}

function domainPair(domain: readonly import("./scales").ScaleInput[] | undefined) {
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

function brushBounds<Row>(drag: DragState, axis: "x" | "y" | "xy", scene: PlotScene<Row>) {
  return {
    x0: axis === "y" ? scene.plotArea.x : drag.startX,
    x1: axis === "y" ? scene.plotArea.x + scene.plotArea.width : drag.currentX,
    y0: axis === "x" ? scene.plotArea.y : drag.startY,
    y1: axis === "x" ? scene.plotArea.y + scene.plotArea.height : drag.currentY,
  };
}

function updateLiveStatus<Row>(state: ControllerState<Row>): void {
  if (!state.liveStatus) return;
  state.liveStatus.textContent = state.config.props.followLatest
    ? state.followPaused
      ? "Live following paused. Use Resume live to follow the latest rows."
      : "Following the latest rows."
    : "";
}

function updateLegendButtons<Row>(state: ControllerState<Row>): void {
  const root = state.host.closest<HTMLElement>('[data-slot="plot-root"]');
  if (!root) return;
  for (const button of root.querySelectorAll<HTMLElement>("[data-plot-series]")) {
    const series = button.dataset.plotSeries;
    if (!series) continue;
    const visible = !state.hiddenSeries.has(series);
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.toggleAttribute("data-filtered", !visible);
  }
}

function exportScene<Row>(state: ControllerState<Row>, view: "current" | "full" | undefined) {
  if (view === "full") {
    return compileRuntimeScene(
      state.config,
      state.scene.width,
      state.scene.height,
      state.config.sourceRows,
      undefined,
    );
  }
  if (!state.transientView) return state.scene;
  return compileRuntimeScene(
    state.config,
    state.scene.width,
    state.scene.height,
    state.followPaused ? (state.frozenFollowRows ?? state.scene.sourceRows) : undefined,
    state.transientView,
  );
}

async function exportPng<Row>(
  state: ControllerState<Row>,
  options: PlotPngExportOptions = {},
): Promise<Blob> {
  if (typeof document === "undefined")
    throw new Error("PNG export requires a mounted browser plot.");
  const scene = exportScene(state, options.view);
  const ratio = Math.max(
    1,
    Number.isFinite(options.pixelRatio) ? options.pixelRatio! : devicePixelRatioValue(),
  );
  const canvas = document.createElement("canvas");
  const context = resizeCanvas(canvas, scene.width, scene.height, ratio);
  if (!context) throw new Error("Canvas 2D is unavailable for PNG export.");
  const exportSceneValue = Object.freeze({ ...scene, pixelRatio: ratio });
  renderPlotScene(context, exportSceneValue, state.theme, {
    background: options.background,
    hiddenSeries: state.hiddenSeries,
    selectedKeys: selectionKeys(state),
  });
  if (options.includeOverlays) {
    renderInteractionOverlay(
      context,
      exportSceneValue,
      state.theme,
      interactionOverlayState(state),
      { clear: false },
    );
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode the plot as PNG."));
    }, "image/png");
  });
}

function exportData<Row>(state: ControllerState<Row>, options: PlotDataExportOptions = {}): string {
  const selection = new Set(state.config.props.selection?.keys ?? state.internalSelection);
  return serializePlotData(exportScene(state, options.view), options, selection);
}

function scheduleCompile<Row>(state: ControllerState<Row>): void {
  if (state.destroyed || state.compileQueued) return;
  state.compileQueued = true;
  if (typeof requestAnimationFrame === "function") {
    state.frameHandle = requestAnimationFrame(() => compileAndPaint(state));
  } else {
    queueMicrotask(() => compileAndPaint(state));
  }
}

function destroyController<Row>(state: ControllerState<Row>): void {
  if (state.destroyed) return;
  state.destroyed = true;
  cancelSceneTransition(state);
  if (state.frameHandle != null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(state.frameHandle);
  }
  if (state.viewCommitTimer != null) clearTimeout(state.viewCommitTimer);
  for (const cleanup of state.cleanups.splice(0)) cleanup();
  assignApiRef(state.currentApiRef, null);
  hideTooltip(state);
  state.baseCanvas.width = 0;
  state.baseCanvas.height = 0;
  state.overlayCanvas.width = 0;
  state.overlayCanvas.height = 0;
  state.pointers.clear();
  state.host.closest<HTMLElement>('[data-slot="plot-root"]')?.removeAttribute("data-panning");
  state.hiddenSeries.clear();
  state.internalSelection.clear();
}

function listen<Row>(
  state: ControllerState<Row>,
  target: EventTarget,
  type: string,
  listener: EventListener,
): void {
  target.addEventListener(type, listener);
  state.cleanups.push(() => target.removeEventListener(type, listener));
}

function assignApiRef<Row>(ref: PlotApiRef<Row> | undefined, value: PlotApi<Row> | null): void {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else ref.current = value;
}

function requireCanvas(host: HTMLElement, slot: string): HTMLCanvasElement {
  const canvas = host.querySelector<HTMLCanvasElement>(`[data-slot="${slot}"]`);
  if (!canvas) throw new Error(`Plot host is missing ${slot}.`);
  return canvas;
}

function measureWidth(host: HTMLElement, fallback: number | undefined): number {
  return Math.max(1, host.clientWidth || host.getBoundingClientRect().width || fallback || 640);
}

function measureHeight(host: HTMLElement, fallback: number | undefined): number {
  return Math.max(1, host.clientHeight || host.getBoundingClientRect().height || fallback || 320);
}

function eventPoint(canvas: HTMLCanvasElement, event: MouseEvent | PointerEvent | WheelEvent) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width > 0 ? canvas.clientWidth / rect.width || 1 : 1;
  const scaleY = rect.height > 0 ? canvas.clientHeight / rect.height || 1 : 1;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function devicePixelRatioValue(): number {
  return typeof devicePixelRatio === "number" && Number.isFinite(devicePixelRatio)
    ? Math.max(1, devicePixelRatio)
    : 1;
}

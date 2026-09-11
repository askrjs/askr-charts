import { compilePlotScene } from "./compiler";
import type { PlotDescriptor } from "./descriptors";
import { serializePlotData, serializePlotSvg } from "./export";
import { createHitIndex, projectHitRegions } from "./hit-index";
import type {
  FollowLatest,
  PlotApi,
  PlotDataExportOptions,
  PlotKey,
  PlotPngExportOptions,
  PlotSvgExportOptions,
  PlotView,
  RootProps,
} from "./model";
import {
  renderInteractionOverlay,
  renderPlotChrome,
  renderPlotMarks,
  renderPlotScene,
  resizeCanvas,
  resolvePlotTheme,
  type PlotInteractionOverlayState,
} from "./render";
import { trimPlotRows } from "./rows";
import type { PlotScene } from "./scene-model";
import {
  interpolateSceneMarks,
  resolveSceneTransitionMode,
  type SceneTransitionMode,
} from "./transitions";
import {
  onClick,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  onWheel,
} from "./controller/pointer";
import {
  filteredHits,
  hideTooltip,
  hitCenter,
  retainSelection,
  selectionKeys,
} from "./controller/selection";
import type { ControllerState } from "./controller/state";
import {
  clearCanvasTransform,
  copyPlotView,
  currentDomainView,
  gestureIsActive,
  resetView as resetViewportView,
  resumeLive as resumeLiveViewport,
} from "./controller/viewport";

export { resolvePlotViewTransform } from "./controller/viewport";

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

export function createPlotController<Row>(
  host: HTMLElement,
  config: PlotRuntimeConfig<Row>,
): PlotController<Row> {
  const chromeCanvas = requireCanvas(host, "plot-canvas-chrome");
  const marksCanvas = requireCanvas(host, "plot-canvas-marks");
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
    chromeCanvas,
    marksCanvas,
    overlayCanvas,
    tooltip: host.querySelector('[data-slot="plot-tooltip"]'),
    tooltipHideTimer: null,
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
    hoverCohort: Object.freeze([]),
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
    inspectionFrameHandle: null,
    pendingInspectionPoint: null,
    pendingDataTransition: false,
    hasPaintedScene: config.transitionFromScene !== undefined,
    transitionScene: null,
    transitionFrameHandle: null,
    canvasAnimation: null,
    currentApiChange: config.props.onApiChange,
    api,
    activeDiagnosticSignatures: new Set<string>(),
    cleanups: [],
  } satisfies Partial<ControllerState<Row>>);

  try {
    bindController(state);
    state.currentApiChange?.(state.api);
    installSceneAndPaint(
      state,
      initialScene,
      initialWidth,
      initialHeight,
      config.transitionFromScene !== undefined,
      config.transitionFromScene,
    );
  } catch (error) {
    const errors = [error];
    try {
      destroyController(state);
    } catch (cleanupError) {
      collectErrors(errors, cleanupError);
    }
    throwCollectedErrors(errors, "Plot controller initialization failed");
  }

  return Object.freeze({
    update(nextConfig: PlotRuntimeConfig<Row>) {
      if (state.destroyed) return;
      const previousApiChange = state.currentApiChange;
      const notificationErrors: unknown[] = [];
      state.pendingDataTransition ||= state.config.sourceRows !== nextConfig.sourceRows;
      state.config = nextConfig;
      state.currentApiChange = nextConfig.props.onApiChange;
      if (previousApiChange !== state.currentApiChange) {
        if (state.currentApiChange) {
          invokeAndCollect(notificationErrors, () => state.currentApiChange?.(state.api));
        } else {
          invokeAndCollect(notificationErrors, () => previousApiChange?.(null));
        }
      }
      if (state.internalSelection.size > 0 || (nextConfig.props.selection?.keys.length ?? 0) > 0) {
        retainSelection(state);
      }
      if (gestureIsActive(state)) state.compileDeferredForGesture = true;
      else scheduleCompile(state);
      throwCollectedErrors(notificationErrors, "Plot API change notification failed");
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
      resetViewportView(state);
    },
    resumeLive() {
      resumeLiveViewport(state);
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
      resetViewportView(state);
    },
    resumeLive() {
      resumeLiveViewport(state);
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
  listen(state, overlay, "lostpointercapture", (event) =>
    onPointerCancel(state, event as PointerEvent),
  );
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
  }

  if (typeof window !== "undefined") {
    const resize = () => scheduleCompile(state);
    window.addEventListener("resize", resize);
    state.cleanups.push(() => window.removeEventListener("resize", resize));
  }

  if (typeof matchMedia === "function") {
    let resolution: MediaQueryList | null = null;
    const resolutionChanged = () => {
      scheduleCompile(state);
      watchResolution();
    };
    const watchResolution = () => {
      resolution?.removeEventListener?.("change", resolutionChanged);
      resolution = matchMedia(`(resolution: ${devicePixelRatioValue()}dppx)`);
      resolution.addEventListener?.("change", resolutionChanged, { once: true });
    };
    watchResolution();
    state.cleanups.push(() => resolution?.removeEventListener?.("change", resolutionChanged));
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
  const wasPainted = state.hasPaintedScene;
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
  resizeCanvas(state.chromeCanvas, width, height, ratio);
  resizeCanvas(state.marksCanvas, width, height, ratio);
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
    animateDataUpdate || !wasPainted
      ? resolveSceneTransitionMode(
          wasPainted ? previousPaintedScene.marks : [],
          state.scene.marks,
          state.hiddenSeries,
          prefersReducedMotion(state),
        )
      : "none";
  state.hasPaintedScene = true;
  setTransitionMode(state, transitionMode);
  if (transitionMode === "keyed") {
    const previous = wasPainted
      ? previousPaintedScene
      : ({ ...state.scene, marks: Object.freeze([]), hits: Object.freeze([]) } as PlotScene<Row>);
    startKeyedSceneTransition(state, previous, state.scene);
  } else {
    paintBaseScene(state, state.scene);
    if (transitionMode === "single") startWholeCanvasTransition(state);
  }
  paintOverlay(state);
  if (state.hiddenSeries.size > 0) updateLegendButtons(state);
  updateLiveStatus(state);
  reportDiagnostics(state, state.config.props.diagnostics === true);
}

function reportDiagnostics<Row>(state: ControllerState<Row>, enabled: boolean): void {
  if (!enabled) {
    state.activeDiagnosticSignatures.clear();
    return;
  }
  const nextSignatures = new Set<string>();
  for (const diagnostic of state.scene.diagnostics) {
    const signature = `${diagnostic.code}:${diagnostic.message}`;
    nextSignatures.add(signature);
    if (!state.activeDiagnosticSignatures.has(signature)) {
      console.warn(`[Askr charts] ${diagnostic.message}`);
    }
  }
  state.activeDiagnosticSignatures = nextSignatures;
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

export function paintBase<Row>(state: ControllerState<Row>): void {
  cancelSceneTransition(state);
  setTransitionMode(state, "none");
  paintBaseScene(state, state.scene);
}

function paintBaseScene<Row>(state: ControllerState<Row>, scene: PlotScene<Row>): void {
  const chrome = state.chromeCanvas.getContext("2d");
  const marks = state.marksCanvas.getContext("2d");
  if (chrome) renderPlotChrome(chrome, scene, state.theme);
  if (!marks) return;
  renderPlotMarks(marks, scene, state.theme, {
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
    const easedProgress = transitionEasing(state.host, linearProgress);
    paintKeyedTransitionFrame(state, next, previousMarks, nextMarks, easedProgress);
    if (linearProgress < 1) {
      state.transitionFrameHandle = requestAnimationFrame(step);
      return;
    }
    state.transitionFrameHandle = null;
    state.transitionScene = null;
    setTransitionMode(state, "none");
    state.hitIndex = createHitIndex(state.scene.hits, {
      width: state.scene.width,
      height: state.scene.height,
    });
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
  const hits = projectHitRegions(next.hits, frameScene.marks);
  const presentedScene = Object.freeze({ ...frameScene, hits });
  state.transitionScene = presentedScene;
  state.hitIndex = createHitIndex(hits, { width: next.width, height: next.height });
  paintBaseScene(state, presentedScene);
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
  const animate = state.marksCanvas.animate;
  if (duration <= 0 || typeof animate !== "function") {
    setTransitionMode(state, "none");
    return;
  }
  const animation = animate.call(state.marksCanvas, [{ opacity: 0.72 }, { opacity: 1 }], {
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

export function prefersReducedMotion<Row>(state: ControllerState<Row>): boolean {
  if (state.host.getAttribute("data-reduced-motion") === "true") return true;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function transitionDurationMs(element: Element): number {
  if (typeof getComputedStyle !== "function") return 160;
  const value = getComputedStyle(element).getPropertyValue("--ak-chart-transition-duration").trim();
  if (value.endsWith("ms")) return Math.max(0, Number.parseFloat(value) || 0);
  if (value.endsWith("s")) return Math.max(0, (Number.parseFloat(value) || 0) * 1_000);
  return 160;
}

function transitionEasing(element: Element, progress: number): number {
  if (typeof getComputedStyle !== "function") return 1 - Math.pow(1 - progress, 3);
  const easing = getComputedStyle(element).getPropertyValue("--ak-chart-transition-easing").trim();
  if (easing === "linear") return progress;
  if (easing === "ease-in") return progress * progress;
  if (easing === "ease-in-out")
    return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  return 1 - Math.pow(1 - progress, 3);
}

function animationNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function paintOverlay<Row>(state: ControllerState<Row>): void {
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
    clip: state.scene.plotArea,
    crosshair,
    brush,
    hover: state.hoverCohort.map((hit) => hit.shape),
    focus: focused ? { ...hitCenter(focused), radius: 6 } : null,
  };
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

export function updateLiveStatus<Row>(state: ControllerState<Row>): void {
  const liveStatus = state.host
    .closest<HTMLElement>('[data-slot="plot-root"]')
    ?.querySelector<HTMLElement>('[data-slot="plot-live-status"]');
  if (!liveStatus) return;
  liveStatus.textContent = state.config.props.followLatest
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
  if (!state.transientView) return state.transitionScene ?? state.scene;
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

export function scheduleCompile<Row>(state: ControllerState<Row>): void {
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
  const errors: unknown[] = [];
  invokeAndCollect(errors, () => cancelSceneTransition(state));
  invokeAndCollect(errors, () => {
    if (state.frameHandle != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(state.frameHandle);
    }
    state.frameHandle = null;
  });
  invokeAndCollect(errors, () => {
    if (state.inspectionFrameHandle != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(state.inspectionFrameHandle);
    }
    state.inspectionFrameHandle = null;
  });
  invokeAndCollect(errors, () => {
    if (state.viewCommitTimer != null) clearTimeout(state.viewCommitTimer);
    state.viewCommitTimer = null;
  });
  invokeAndCollect(errors, () => {
    if (state.tooltipHideTimer != null) clearTimeout(state.tooltipHideTimer);
    state.tooltipHideTimer = null;
  });
  for (const cleanup of state.cleanups.splice(0)) invokeAndCollect(errors, cleanup);
  const onApiChange = state.currentApiChange;
  state.currentApiChange = undefined;
  invokeAndCollect(errors, () => onApiChange?.(null));
  invokeAndCollect(errors, () => hideTooltip(state));
  invokeAndCollect(errors, () => {
    state.chromeCanvas.width = 0;
    state.chromeCanvas.height = 0;
    state.marksCanvas.width = 0;
    state.marksCanvas.height = 0;
    state.overlayCanvas.width = 0;
    state.overlayCanvas.height = 0;
  });
  invokeAndCollect(errors, () => state.pointers.clear());
  invokeAndCollect(errors, () =>
    state.host.closest<HTMLElement>('[data-slot="plot-root"]')?.removeAttribute("data-panning"),
  );
  invokeAndCollect(errors, () => state.hiddenSeries.clear());
  invokeAndCollect(errors, () => state.internalSelection.clear());
  state.activeDiagnosticSignatures.clear();
  throwCollectedErrors(errors, "Plot controller cleanup failed");
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

function invokeAndCollect(errors: unknown[], operation: () => void): void {
  try {
    operation();
  } catch (error) {
    collectErrors(errors, error);
  }
}

function collectErrors(errors: unknown[], error: unknown): void {
  if (isAggregateError(error)) errors.push(...error.errors);
  else errors.push(error);
}

function throwCollectedErrors(errors: unknown[], message: string): void {
  if (errors.length === 0) return;
  if (errors.length === 1) throw errors[0];
  throw new RuntimeAggregateError(errors, message);
}

interface AggregateErrorLike extends Error {
  readonly errors: readonly unknown[];
}

const RuntimeAggregateError = (
  globalThis as typeof globalThis & {
    AggregateError: new (errors: Iterable<unknown>, message?: string) => AggregateErrorLike;
  }
).AggregateError;

function isAggregateError(error: unknown): error is AggregateErrorLike {
  return error instanceof RuntimeAggregateError;
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

function devicePixelRatioValue(): number {
  return typeof devicePixelRatio === "number" && Number.isFinite(devicePixelRatio)
    ? Math.max(1, devicePixelRatio)
    : 1;
}

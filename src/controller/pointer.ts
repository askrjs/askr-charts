import { paintOverlay } from "../controller";
import {
  activateHit,
  announceFocusedHit,
  filteredHits,
  hideTooltip,
  inspectionHits,
  queryVisibleHit,
  setSelection,
  toggleFocusedSelection,
  updateTooltip,
} from "./selection";
import type { ControllerState, DragState } from "./state";
import {
  brushBounds,
  commitTransientView,
  currentDomainView,
  flushDeferredGestureCompile,
  hasContinuousZoomAxis,
  panTo,
  pointInPlotArea,
  resetView,
  zoomAt,
} from "./viewport";

export function onPointerMove<Row>(state: ControllerState<Row>, event: PointerEvent): void {
  const point = eventPoint(state.overlayCanvas, event);
  // Only pointerdown registers an active gesture pointer. Hover moves must not
  // linger in this map or the next drag is incorrectly interpreted as a pinch.
  if (state.pointers.has(event.pointerId)) state.pointers.set(event.pointerId, point);
  if (
    state.pointers.size >= 2 &&
    state.scene.interactions.zoom?.pinch &&
    hasContinuousZoomAxis(state)
  ) {
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

  schedulePointerInspection(state, point);
}

export function schedulePointerInspection<Row>(
  state: ControllerState<Row>,
  point: { x: number; y: number },
): void {
  state.pendingInspectionPoint = point;
  if (state.inspectionFrameHandle != null) return;
  const inspect = () => {
    state.inspectionFrameHandle = null;
    const pending = state.pendingInspectionPoint;
    state.pendingInspectionPoint = null;
    if (!pending || state.destroyed) return;
    const cohort = inspectionHits(state, pending.x, pending.y);
    state.hoverCohort = cohort;
    state.hover = cohort[0] ?? null;
    state.host.dataset.cursor = state.hover
      ? state.config.props.onActivate || state.scene.interactions.select
        ? "action"
        : "inspect"
      : "default";
    updateTooltip(state, pending.x, pending.y);
    paintOverlay(state);
  };
  state.inspectionFrameHandle =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(inspect)
      : (setTimeout(inspect, 0) as unknown as number);
}

export function onPointerDown<Row>(state: ControllerState<Row>, event: PointerEvent): void {
  const point = eventPoint(state.overlayCanvas, event);
  if (!pointInPlotArea(state.scene, point)) return;
  state.suppressClick = false;
  state.pointers.set(event.pointerId, point);
  try {
    state.overlayCanvas.setPointerCapture?.(event.pointerId);
  } catch {
    // Synthetic events and pointers that have already ended cannot be captured.
    // Canvas-local events still provide enough information to track the gesture.
  }
  if (
    state.pointers.size >= 2 &&
    state.scene.interactions.zoom?.pinch &&
    hasContinuousZoomAxis(state)
  ) {
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
  } else if (
    state.scene.interactions.zoom?.pan &&
    event.button === 0 &&
    hasContinuousZoomAxis(state)
  ) {
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

export function onPointerUp<Row>(state: ControllerState<Row>, event: PointerEvent): void {
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
  drag.moved ||= Math.hypot(point.x - drag.startX, point.y - drag.startY) > 3;
  if (drag.mode === "pan" && drag.moved) {
    panTo(state, drag, point.x, point.y);
  }
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

export function onPointerCancel<Row>(state: ControllerState<Row>, event: PointerEvent): void {
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

export function onPointerLeave<Row>(state: ControllerState<Row>, event: PointerEvent): void {
  state.pointers.delete(event.pointerId);
  if (state.pointers.size === 0) {
    state.host.closest<HTMLElement>('[data-slot="plot-root"]')?.removeAttribute("data-panning");
    if (state.transientView) commitTransientView(state);
  }
  if (!state.drag) {
    state.hover = null;
    state.hoverCohort = Object.freeze([]);
    state.host.dataset.cursor = "default";
    hideTooltip(state);
    paintOverlay(state);
  }
}

export function onWheel<Row>(state: ControllerState<Row>, event: WheelEvent): void {
  if (!state.scene.interactions.zoom?.wheel || !hasContinuousZoomAxis(state)) return;
  const point = eventPoint(state.overlayCanvas, event);
  if (!pointInPlotArea(state.scene, point)) return;
  event.preventDefault();
  const modeMultiplier =
    event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? state.scene.height : 1;
  const factor = Math.exp(Math.max(-1, Math.min(1, event.deltaY * modeMultiplier * 0.002)));
  zoomAt(state, point.x, point.y, factor, true);
}

export function onClick<Row>(state: ControllerState<Row>, event: MouseEvent): void {
  if (state.suppressClick) {
    state.suppressClick = false;
    return;
  }
  const point = eventPoint(state.overlayCanvas, event);
  const hit = queryVisibleHit(state, point.x, point.y);
  if (hit) activateHit(state, hit, "pointer");
  else if (state.scene.interactions.select) setSelection(state, new Set());
}

export function onKeyDown<Row>(state: ControllerState<Row>, event: KeyboardEvent): void {
  const hits = filteredHits(state);
  const zoom = state.scene.interactions.zoom;
  if (zoom && (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_")) {
    event.preventDefault();
    const area = state.scene.plotArea;
    zoomAt(
      state,
      area.x + area.width / 2,
      area.y + area.height / 2,
      event.key === "+" || event.key === "=" ? 0.8 : 1.25,
      false,
    );
    commitTransientView(state);
  } else if (
    event.shiftKey &&
    zoom?.pan &&
    (event.key === "ArrowRight" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp")
  ) {
    event.preventDefault();
    panWithKeyboard(state, event.key);
  } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    state.focusIndex = hits.length === 0 ? -1 : (state.focusIndex + 1 + hits.length) % hits.length;
    announceFocusedHit(state, hits[state.focusIndex] ?? null);
    paintOverlay(state);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    state.focusIndex = hits.length === 0 ? -1 : (state.focusIndex - 1 + hits.length) % hits.length;
    announceFocusedHit(state, hits[state.focusIndex] ?? null);
    paintOverlay(state);
  } else if (event.shiftKey && event.key === " " && state.scene.interactions.brush) {
    const hit = hits[state.focusIndex];
    if (hit) {
      event.preventDefault();
      toggleFocusedSelection(state, hit);
    }
  } else if (event.key === "Enter" || event.key === " ") {
    const hit = hits[state.focusIndex];
    if (hit) {
      event.preventDefault();
      activateHit(state, hit, "keyboard");
    }
  } else if (event.key === "Escape") {
    state.focusIndex = -1;
    state.hover = null;
    state.hoverCohort = Object.freeze([]);
    if (state.scene.interactions.select) setSelection(state, new Set());
    hideTooltip(state);
    paintOverlay(state);
  } else if (zoom && event.key === "Home") {
    event.preventDefault();
    resetView(state);
  }
}

function panWithKeyboard<Row>(
  state: ControllerState<Row>,
  key: "ArrowRight" | "ArrowDown" | "ArrowLeft" | "ArrowUp",
): void {
  const area = state.scene.plotArea;
  const startX = area.x + area.width / 2;
  const startY = area.y + area.height / 2;
  const horizontal = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  const vertical = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  const drag: DragState = {
    mode: "pan",
    pointerId: -1,
    startX,
    startY,
    currentX: startX - horizontal * area.width * 0.1,
    currentY: startY - vertical * area.height * 0.1,
    startView: currentDomainView(state.scene),
    moved: true,
  };
  panTo(state, drag, drag.currentX, drag.currentY);
  commitTransientView(state);
}

export function eventPoint(
  canvas: HTMLCanvasElement,
  event: MouseEvent | PointerEvent | WheelEvent,
) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width > 0 ? canvas.clientWidth / rect.width || 1 : 1;
  const scaleY = rect.height > 0 ? canvas.clientHeight / rect.height || 1 : 1;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

import type {
  PlotInteractionOrigin,
  PlotInteractionTarget,
  PlotKey,
  PlotRowKey,
  PlotSelection,
} from "../model";
import type { HitRegion } from "../scene-model";
import { paintBase, paintOverlay, prefersReducedMotion, transitionDurationMs } from "../controller";
import type { ControllerState } from "./state";

export function setSelection<Row>(state: ControllerState<Row>, keys: Set<PlotKey>): void {
  const selection: PlotSelection = Object.freeze({ keys: Object.freeze([...keys]) });
  state.config.props.onSelectionChange?.(selection);
  if (state.config.props.selection === undefined) state.internalSelection = keys;
  paintBase(state);
  paintOverlay(state);
}

export function selectionKeys<Row>(state: ControllerState<Row>): ReadonlySet<PlotKey> {
  return state.config.props.selection
    ? new Set(state.config.props.selection.keys)
    : state.internalSelection;
}

export function retainSelection<Row>(state: ControllerState<Row>): void {
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

export function readKeySafe<Row>(row: Row, index: number, rowKey: PlotRowKey<Row>): PlotKey {
  const value =
    typeof rowKey === "function" ? rowKey(row, index) : (row as Record<string, unknown>)[rowKey];
  return typeof value === "string" || typeof value === "number" ? value : index;
}

export function updateTooltip<Row>(state: ControllerState<Row>, x: number, y: number): void {
  const tooltip = state.tooltip;
  if (!tooltip || !state.scene.interactions.tooltip || !state.hover) {
    hideTooltip(state);
    return;
  }
  const channels = state.scene.interactions.tooltipChannels;
  const record = tooltipRecord(state.hover, channels);
  const formatted = state.scene.interactions.tooltipFormat?.(Object.freeze(record));
  if (state.tooltipHideTimer != null) clearTimeout(state.tooltipHideTimer);
  state.tooltipHideTimer = null;
  tooltip.hidden = false;
  tooltip.dataset.open = "true";
  tooltip.setAttribute("aria-hidden", "false");
  if (formatted != null) {
    tooltip.textContent = formatted;
  } else {
    const heading = document.createElement("strong");
    heading.className = "ak-plot-tooltip-heading";
    heading.dataset.slot = "plot-tooltip-heading";
    heading.textContent = state.hover.title;
    const rows = document.createElement("dl");
    rows.className = "ak-plot-tooltip-values";
    rows.dataset.slot = "plot-tooltip-values";
    const cohort = state.hoverCohort.length > 0 ? state.hoverCohort : [state.hover];
    for (const hit of cohort) {
      const values = tooltipRecord(hit, channels);
      const entries = Object.entries(values);
      for (const [channel, value] of entries) {
        const term = document.createElement("dt");
        const detail = document.createElement("dd");
        term.textContent = hit.series ? `${hit.series} · ${channel}: ` : `${channel}: `;
        detail.textContent = formatTooltipValue(value, state.config.props.locale);
        rows.append(term, detail);
      }
    }
    tooltip.replaceChildren(heading, rows);
  }
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

export function tooltipRecord<Row>(
  hit: HitRegion<Row>,
  channels: readonly string[] | null | undefined,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(hit.channels).filter(
      ([channel]) => channels == null || channels.includes(channel),
    ),
  );
}

export function announceFocusedHit<Row>(state: ControllerState<Row>, hit: HitRegion<Row> | null): void {
  state.hover = hit;
  if (!hit) {
    hideTooltip(state);
    return;
  }
  const center = hitCenter(hit);
  updateTooltip(state, center.x, center.y);
}

export function hideTooltip<Row>(state: ControllerState<Row>): void {
  if (!state.tooltip) return;
  state.tooltip.removeAttribute("data-open");
  state.tooltip.setAttribute("aria-hidden", "true");
  if (state.tooltip.hidden) return;
  if (state.tooltipHideTimer != null) clearTimeout(state.tooltipHideTimer);
  const tooltip = state.tooltip;
  state.tooltipHideTimer = setTimeout(
    () => {
      tooltip.hidden = true;
      state.tooltipHideTimer = null;
    },
    prefersReducedMotion(state) ? 0 : transitionDurationMs(state.host),
  );
}

export function formatTooltipValue(value: unknown, locale?: string): string {
  if (value instanceof Date)
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      value,
    );
  if (value == null) return "missing";
  if (typeof value === "number" && !Number.isFinite(value)) return "missing";
  if (typeof value === "number") return new Intl.NumberFormat(locale).format(value);
  return String(value);
}

export function inspectionHits<Row>(
  state: ControllerState<Row>,
  x: number,
  y: number,
): readonly HitRegion<Row>[] {
  const direct = queryVisibleHit(state, x, y);
  const mode = state.scene.interactions.tooltipMode;
  if (mode === "mark" || (mode === "auto" && direct && !isSharedXMark(direct))) {
    return Object.freeze(direct ? [direct] : []);
  }
  const area = state.scene.plotArea;
  if (x < area.x || x > area.x + area.width || y < area.y || y > area.y + area.height) {
    return Object.freeze([]);
  }
  const candidates = filteredHits(state).filter(isSharedXMark);
  if (candidates.length === 0) return Object.freeze(direct ? [direct] : []);
  let nearestX = Number.POSITIVE_INFINITY;
  for (const hit of candidates) nearestX = Math.min(nearestX, Math.abs(hitCenter(hit).x - x));
  const cohort = candidates
    .filter((hit) => Math.abs(Math.abs(hitCenter(hit).x - x) - nearestX) <= 0.75)
    .sort((left, right) => Math.abs(hitCenter(left).y - y) - Math.abs(hitCenter(right).y - y));
  return Object.freeze(cohort);
}

export function isSharedXMark<Row>(hit: HitRegion<Row>): boolean {
  return hit.mark !== "arc" && hit.mark !== "rect";
}

export function queryVisibleHit<Row>(
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

export function filteredHits<Row>(state: ControllerState<Row>): readonly HitRegion<Row>[] {
  const unique = new Map<string, HitRegion<Row>>();
  for (const hit of state.scene.hits) {
    if (hit.series && state.hiddenSeries.has(hit.series)) continue;
    const identity = `${hit.markId ?? hit.id.replace(/-hit(?:-\d+)?$/, "")}:${String(hit.key)}`;
    if (!unique.has(identity)) unique.set(identity, hit);
  }
  return Object.freeze([...unique.values()]);
}

export function hitCenter<Row>(hit: HitRegion<Row>): { x: number; y: number } {
  const shape = hit.shape;
  if (shape.kind === "rect") return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
  if (shape.kind === "circle") return { x: shape.x, y: shape.y };
  if (shape.kind === "line") return { x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2 };
  if (shape.kind === "polyline" || shape.kind === "polygon") {
    const count = Math.max(1, shape.points.length);
    return {
      x: shape.points.reduce((sum, point) => sum + point.x, 0) / count,
      y: shape.points.reduce((sum, point) => sum + point.y, 0) / count,
    };
  }
  if (shape.kind === "text") return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
  const angle = (shape.startAngle + shape.endAngle) / 2;
  const radius = (shape.innerRadius + shape.outerRadius) / 2;
  return { x: shape.cx + Math.cos(angle) * radius, y: shape.cy + Math.sin(angle) * radius };
}

export function sourceKeysForHit<Row>(
  state: ControllerState<Row>,
  hit: HitRegion<Row>,
): readonly PlotKey[] {
  if (hit.sourceKeys && hit.sourceKeys.length > 0) return hit.sourceKeys;
  return (
    state.scene.transformedRows.find((candidate) => candidate.key === hit.key)?.sourceKeys ?? [
      hit.key,
    ]
  );
}

export function toggleFocusedSelection<Row>(state: ControllerState<Row>, hit: HitRegion<Row>): void {
  const keys = new Set(selectionKeys(state));
  const sourceKeys = sourceKeysForHit(state, hit);
  const selected = sourceKeys.every((key) => keys.has(key));
  for (const key of sourceKeys) {
    if (selected) keys.delete(key);
    else keys.add(key);
  }
  setSelection(state, keys);
}

export function activateHit<Row>(
  state: ControllerState<Row>,
  hit: HitRegion<Row>,
  origin: PlotInteractionOrigin,
): void {
  const sourceKeys = sourceKeysForHit(state, hit);
  const select = state.scene.interactions.select;
  if (select) {
    const keys = select.mode === "toggle" ? new Set(selectionKeys(state)) : new Set<PlotKey>();
    const allSelected = sourceKeys.every((key) => keys.has(key));
    for (const key of sourceKeys) {
      if (select.mode === "toggle" && allSelected) keys.delete(key);
      else keys.add(key);
    }
    setSelection(state, keys);
  }
  const target: PlotInteractionTarget<Row> = Object.freeze({
    row: hit.row,
    key: hit.key,
    sourceKeys,
    markKind: hit.mark,
    markId: hit.markId ?? hit.id.replace(/-hit(?:-\d+)?$/, ""),
    series: hit.series,
    channels: hit.channels,
    origin,
  });
  state.config.props.onActivate?.(hit.row, hit.key, target);
}

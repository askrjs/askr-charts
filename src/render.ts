import { arcPath, areaPath, roundedRectPath, segmentedLinePath } from "./paths";
import type { PlotKey } from "./model";
import type { PlotScene, SceneMark } from "./scene-model";

export interface PlotTheme {
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly textMuted: string;
  readonly grid: string;
  readonly axis: string;
  readonly focus: string;
  readonly selection: string;
  readonly selectionBorder: string;
  readonly crosshair: string;
  readonly series: readonly string[];
  readonly font: string;
  readonly smallFont: string;
}

export const defaultPlotTheme: PlotTheme = Object.freeze({
  background: "#ffffff",
  surface: "#ffffff",
  text: "#18181b",
  textMuted: "#71717a",
  grid: "rgba(113, 113, 122, 0.18)",
  axis: "rgba(113, 113, 122, 0.56)",
  focus: "#2563eb",
  selection: "rgba(37, 99, 235, 0.16)",
  selectionBorder: "#2563eb",
  crosshair: "rgba(63, 63, 70, 0.68)",
  series: Object.freeze([
    "#2563eb",
    "#7c3aed",
    "#059669",
    "#d97706",
    "#dc2626",
    "#0891b2",
    "#be185d",
    "#ea580c",
    "#0f766e",
    "#4f46e5",
  ]),
  font: "12px system-ui, sans-serif",
  smallFont: "11px system-ui, sans-serif",
});

export function resolvePlotTheme(element: Element | null): PlotTheme {
  if (!element || typeof getComputedStyle !== "function")
    return defaultPlotTheme;
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  const fontFamily = read("--ak-chart-font-family", "system-ui, sans-serif");
  const fontSize = read("--ak-chart-font-size-small", "12px");
  return Object.freeze({
    background: read("--ak-chart-bg", defaultPlotTheme.background),
    surface: read("--ak-chart-surface", defaultPlotTheme.surface),
    text: read("--ak-chart-text", defaultPlotTheme.text),
    textMuted: read("--ak-chart-text-muted", defaultPlotTheme.textMuted),
    grid: read("--ak-chart-grid", defaultPlotTheme.grid),
    axis: read("--ak-chart-axis", defaultPlotTheme.axis),
    focus: read("--ak-chart-focus-ring", defaultPlotTheme.focus),
    selection: read("--ak-chart-selection", defaultPlotTheme.selection),
    selectionBorder: read(
      "--ak-chart-selection-border",
      defaultPlotTheme.selectionBorder,
    ),
    crosshair: read("--ak-chart-crosshair", defaultPlotTheme.crosshair),
    series: Object.freeze(
      defaultPlotTheme.series.map((fallback, index) =>
        read(`--ak-chart-series-${index + 1}`, fallback),
      ),
    ),
    font: `${fontSize} ${fontFamily}`,
    smallFont: `${fontSize} ${fontFamily}`,
  });
}

export function resolvePaint(value: string, theme: PlotTheme): string {
  const series = /(?:var\()?--ak-chart-series-(\d+)/.exec(value);
  if (series) {
    return (
      theme.series[(Number(series[1]) - 1) % theme.series.length] ??
      theme.series[0]!
    );
  }
  const tokens: Record<string, string> = {
    "var(--ak-chart-bg)": theme.background,
    "var(--ak-chart-surface)": theme.surface,
    "var(--ak-chart-text)": theme.text,
    "var(--ak-chart-text-muted)": theme.textMuted,
    "var(--ak-chart-grid)": theme.grid,
    "var(--ak-chart-axis)": theme.axis,
    "var(--ak-chart-focus-ring)": theme.focus,
    "var(--ak-chart-selection)": theme.selection,
    "var(--ak-chart-selection-border)": theme.selectionBorder,
    "var(--ak-chart-crosshair)": theme.crosshair,
  };
  return tokens[value] ?? value;
}

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelRatio: number,
): CanvasRenderingContext2D | null {
  const ratio = Math.max(1, Number.isFinite(pixelRatio) ? pixelRatio : 1);
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  if (context) context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

export function renderPlotScene<Row>(
  context: CanvasRenderingContext2D,
  scene: PlotScene<Row>,
  theme: PlotTheme,
  options: {
    background?: string | null;
    hiddenSeries?: ReadonlySet<string>;
    selectedKeys?: ReadonlySet<PlotKey>;
  } = {},
): void {
  context.save();
  context.setTransform(scene.pixelRatio, 0, 0, scene.pixelRatio, 0, 0);
  context.clearRect(0, 0, scene.width, scene.height);
  if (options.background !== null) {
    context.fillStyle = options.background ?? theme.surface;
    context.fillRect(0, 0, scene.width, scene.height);
  }

  drawGrids(context, scene, theme);
  context.save();
  context.beginPath();
  context.rect(
    scene.plotArea.x,
    scene.plotArea.y,
    scene.plotArea.width,
    scene.plotArea.height,
  );
  context.clip();
  for (const mark of scene.marks) {
    if (mark.series && options.hiddenSeries?.has(mark.series)) continue;
    drawMark(context, mark, theme);
    if (options.selectedKeys && (options.selectedKeys.has(mark.key) || (mark.sourceKeys ?? []).some((key) => options.selectedKeys?.has(key))))
      drawSelectedMark(context, mark, theme);
  }
  context.restore();
  drawAxes(context, scene, theme);
  context.restore();
}

function drawGrids<Row>(
  context: CanvasRenderingContext2D,
  scene: PlotScene<Row>,
  theme: PlotTheme,
) {
  context.save();
  context.strokeStyle = theme.grid;
  context.lineWidth = 1;
  context.beginPath();
  for (const grid of scene.grids) {
    for (const position of grid.positions) {
      if (grid.axis === "x") {
        context.moveTo(position, scene.plotArea.y);
        context.lineTo(position, scene.plotArea.y + scene.plotArea.height);
      } else {
        context.moveTo(scene.plotArea.x, position);
        context.lineTo(scene.plotArea.x + scene.plotArea.width, position);
      }
    }
  }
  context.stroke();
  context.restore();
}

function drawAxes<Row>(
  context: CanvasRenderingContext2D,
  scene: PlotScene<Row>,
  theme: PlotTheme,
) {
  context.save();
  context.strokeStyle = theme.axis;
  context.fillStyle = theme.textMuted;
  context.lineWidth = 1;
  context.font = theme.smallFont;
  for (const axis of scene.axes) {
    const horizontal =
      axis.orientation === "top" || axis.orientation === "bottom";
    const edge =
      axis.orientation === "top"
        ? scene.plotArea.y
        : axis.orientation === "bottom"
          ? scene.plotArea.y + scene.plotArea.height
          : axis.orientation === "left"
            ? scene.plotArea.x
            : scene.plotArea.x + scene.plotArea.width;
    context.beginPath();
    if (horizontal) {
      context.moveTo(scene.plotArea.x, edge);
      context.lineTo(scene.plotArea.x + scene.plotArea.width, edge);
    } else {
      context.moveTo(edge, scene.plotArea.y);
      context.lineTo(edge, scene.plotArea.y + scene.plotArea.height);
    }
    context.stroke();
    for (const tick of axis.ticks) {
      context.beginPath();
      if (horizontal) {
        const direction = axis.orientation === "top" ? -1 : 1;
        context.moveTo(tick.position, edge);
        context.lineTo(tick.position, edge + direction * 4);
        context.stroke();
        context.textAlign = "center";
        context.textBaseline = axis.orientation === "top" ? "bottom" : "top";
        context.fillText(tick.label, tick.position, edge + direction * 7);
      } else {
        const direction = axis.orientation === "left" ? -1 : 1;
        context.moveTo(edge, tick.position);
        context.lineTo(edge + direction * 4, tick.position);
        context.stroke();
        context.textAlign = axis.orientation === "left" ? "right" : "left";
        context.textBaseline = "middle";
        context.fillText(tick.label, edge + direction * 7, tick.position);
      }
    }
    if (axis.label) drawAxisLabel(context, scene, axis.orientation, axis.label);
  }
  context.restore();
}

function drawAxisLabel<Row>(
  context: CanvasRenderingContext2D,
  scene: PlotScene<Row>,
  orientation: "top" | "right" | "bottom" | "left",
  label: string,
): void {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  if (orientation === "top" || orientation === "bottom") {
    const y =
      orientation === "top"
        ? Math.max(8, scene.plotArea.y - 30)
        : Math.min(
            scene.height - 8,
            scene.plotArea.y + scene.plotArea.height + 30,
          );
    context.fillText(label, scene.plotArea.x + scene.plotArea.width / 2, y);
  } else {
    const x =
      orientation === "left"
        ? Math.max(8, scene.plotArea.x - 43)
        : Math.min(
            scene.width - 8,
            scene.plotArea.x + scene.plotArea.width + 43,
          );
    const y = scene.plotArea.y + scene.plotArea.height / 2;
    context.translate(x, y);
    context.rotate(orientation === "left" ? -Math.PI / 2 : Math.PI / 2);
    context.fillText(label, 0, 0);
  }
  context.restore();
}

function drawMark<Row>(
  context: CanvasRenderingContext2D,
  mark: SceneMark<Row>,
  theme: PlotTheme,
) {
  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, mark.opacity));
  context.fillStyle = resolvePaint(mark.fill, theme);
  context.strokeStyle = resolvePaint(mark.stroke, theme);
  switch (mark.kind) {
    case "bar":
    case "cell":
    case "rect": {
      const path = new Path2D(
        roundedRectPath(mark.x, mark.y, mark.width, mark.height, mark.radius),
      );
      if (mark.fill !== "none") context.fill(path);
      if (mark.stroke !== "none") context.stroke(path);
      break;
    }
    case "line": {
      context.lineWidth = mark.strokeWidth;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.stroke(new Path2D(segmentedLinePath(mark.segments, mark.curve)));
      break;
    }
    case "area": {
      const path = new Path2D(areaPath(mark.points, mark.baseline, mark.curve));
      context.fill(path);
      if (mark.stroke !== "none") context.stroke(path);
      break;
    }
    case "point": {
      context.beginPath();
      if (mark.shape === "square") {
        context.rect(
          mark.x - mark.radius,
          mark.y - mark.radius,
          mark.radius * 2,
          mark.radius * 2,
        );
      } else if (mark.shape === "diamond") {
        context.moveTo(mark.x, mark.y - mark.radius);
        context.lineTo(mark.x + mark.radius, mark.y);
        context.lineTo(mark.x, mark.y + mark.radius);
        context.lineTo(mark.x - mark.radius, mark.y);
        context.closePath();
      } else {
        context.arc(mark.x, mark.y, mark.radius, 0, Math.PI * 2);
      }
      context.fill();
      if (mark.stroke !== "none") context.stroke();
      break;
    }
    case "arc": {
      const path = new Path2D(arcPath(mark));
      context.fill(path);
      if (mark.stroke !== "none") context.stroke(path);
      break;
    }
    case "rule": {
      context.lineWidth = mark.strokeWidth;
      context.setLineDash([...mark.dash]);
      context.beginPath();
      context.moveTo(mark.x1, mark.y1);
      context.lineTo(mark.x2, mark.y2);
      context.stroke();
      break;
    }
    case "text": {
      context.font = mark.font || theme.font;
      context.textAlign = mark.align;
      context.textBaseline = mark.baseline;
      context.fillText(mark.text, mark.x, mark.y);
      break;
    }
  }
  context.restore();
}

function drawSelectedMark<Row>(
  context: CanvasRenderingContext2D,
  mark: SceneMark<Row>,
  theme: PlotTheme,
): void {
  context.save();
  context.globalAlpha = 1;
  context.strokeStyle = theme.selectionBorder;
  context.lineWidth = 2.5;
  context.setLineDash([]);
  switch (mark.kind) {
    case "bar":
    case "cell":
    case "rect":
      context.stroke(
        new Path2D(
          roundedRectPath(mark.x, mark.y, mark.width, mark.height, mark.radius),
        ),
      );
      break;
    case "point":
      context.beginPath();
      context.arc(mark.x, mark.y, mark.radius + 3, 0, Math.PI * 2);
      context.stroke();
      break;
    case "arc":
      context.stroke(new Path2D(arcPath(mark)));
      break;
    case "rule":
      context.beginPath();
      context.moveTo(mark.x1, mark.y1);
      context.lineTo(mark.x2, mark.y2);
      context.stroke();
      break;
    case "line":
    case "area":
    case "text":
      break;
  }
  context.restore();
}

export interface PlotInteractionOverlayState {
  readonly crosshair?: { x: number; y: number; axes: "x" | "y" | "xy" } | null;
  readonly brush?: { x0: number; y0: number; x1: number; y1: number } | null;
  readonly focus?: { x: number; y: number; radius?: number } | null;
}

export function renderInteractionOverlay(
  context: CanvasRenderingContext2D,
  dimensions: { width: number; height: number; pixelRatio: number },
  theme: PlotTheme,
  state: PlotInteractionOverlayState,
  options: { clear?: boolean } = {},
): void {
  context.save();
  context.setTransform(
    dimensions.pixelRatio,
    0,
    0,
    dimensions.pixelRatio,
    0,
    0,
  );
  if (options.clear ?? true)
    context.clearRect(0, 0, dimensions.width, dimensions.height);
  if (state.crosshair) {
    context.strokeStyle = theme.crosshair;
    context.lineWidth = 1;
    context.setLineDash([3, 3]);
    context.beginPath();
    if (state.crosshair.axes.includes("x")) {
      context.moveTo(state.crosshair.x, 0);
      context.lineTo(state.crosshair.x, dimensions.height);
    }
    if (state.crosshair.axes.includes("y")) {
      context.moveTo(0, state.crosshair.y);
      context.lineTo(dimensions.width, state.crosshair.y);
    }
    context.stroke();
  }
  if (state.brush) {
    const x = Math.min(state.brush.x0, state.brush.x1);
    const y = Math.min(state.brush.y0, state.brush.y1);
    const width = Math.abs(state.brush.x1 - state.brush.x0);
    const height = Math.abs(state.brush.y1 - state.brush.y0);
    context.fillStyle = theme.selection;
    context.strokeStyle = theme.selectionBorder;
    context.setLineDash([]);
    context.fillRect(x, y, width, height);
    context.strokeRect(x, y, width, height);
  }
  if (state.focus) {
    context.strokeStyle = theme.focus;
    context.lineWidth = 2;
    context.setLineDash([]);
    context.beginPath();
    context.arc(
      state.focus.x,
      state.focus.y,
      state.focus.radius ?? 6,
      0,
      Math.PI * 2,
    );
    context.stroke();
  }
  context.restore();
}

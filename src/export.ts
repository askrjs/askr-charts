import type { PlotDataExportOptions, PlotKey, PlotSvgExportOptions } from "./model";
import {
  arcPath,
  areaPath,
  escapeXml,
  formatNumber,
  roundedRectPath,
  segmentedLinePath,
} from "./paths";
import {
  defaultPlotTheme,
  resolvePaint,
  type PlotInteractionOverlayState,
  type PlotTheme,
} from "./render";
import type { PlotScene, SceneMark } from "./scene-model";

export function serializePlotSvg<Row>(
  scene: PlotScene<Row>,
  options: PlotSvgExportOptions & {
    theme?: PlotTheme;
    hiddenSeries?: ReadonlySet<string>;
    selectedKeys?: ReadonlySet<PlotKey>;
    overlays?: PlotInteractionOverlayState;
  } = {},
): string {
  const theme = options.theme ?? defaultPlotTheme;
  const background = options.background === undefined ? theme.surface : options.background;
  const content: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(scene.width)}" height="${formatNumber(scene.height)}" viewBox="0 0 ${formatNumber(scene.width)} ${formatNumber(scene.height)}" role="img">`,
    `<title>${escapeXml(scene.summary)}</title>`,
  ];
  if (background !== null) {
    content.push(`<rect width="100%" height="100%" fill="${escapeXml(background)}"/>`);
  }

  if (scene.grids.length > 0) {
    content.push(`<g fill="none" stroke="${escapeXml(theme.grid)}" stroke-width="1">`);
    for (const grid of scene.grids) {
      for (const position of grid.positions) {
        content.push(
          grid.axis === "x"
            ? `<path d="M${formatNumber(position)},${formatNumber(scene.plotArea.y)}V${formatNumber(scene.plotArea.y + scene.plotArea.height)}"/>`
            : `<path d="M${formatNumber(scene.plotArea.x)},${formatNumber(position)}H${formatNumber(scene.plotArea.x + scene.plotArea.width)}"/>`,
        );
      }
    }
    content.push("</g>");
  }

  content.push(
    `<svg x="${formatNumber(scene.plotArea.x)}" y="${formatNumber(scene.plotArea.y)}" width="${formatNumber(scene.plotArea.width)}" height="${formatNumber(scene.plotArea.height)}" viewBox="${formatNumber(scene.plotArea.x)} ${formatNumber(scene.plotArea.y)} ${formatNumber(scene.plotArea.width)} ${formatNumber(scene.plotArea.height)}" overflow="hidden">`,
  );
  for (const mark of scene.marks) {
    if (mark.series && options.hiddenSeries?.has(mark.series)) continue;
    content.push(
      serializeMark(
        mark,
        theme,
        Boolean(
          options.selectedKeys &&
          (options.selectedKeys.has(mark.key) ||
            (mark.sourceKeys ?? []).some((key) => options.selectedKeys?.has(key))),
        ),
      ),
    );
  }
  content.push("</svg>");

  content.push(
    `<g fill="${escapeXml(theme.textMuted)}" stroke="${escapeXml(theme.axis)}" style="font:${escapeXml(theme.smallFont)}">`,
  );
  for (const axis of scene.axes) {
    const horizontal = axis.orientation === "top" || axis.orientation === "bottom";
    const edge =
      axis.orientation === "top"
        ? scene.plotArea.y
        : axis.orientation === "bottom"
          ? scene.plotArea.y + scene.plotArea.height
          : axis.orientation === "left"
            ? scene.plotArea.x
            : scene.plotArea.x + scene.plotArea.width;
    content.push(
      horizontal
        ? `<path fill="none" d="M${formatNumber(scene.plotArea.x)},${formatNumber(edge)}H${formatNumber(scene.plotArea.x + scene.plotArea.width)}"/>`
        : `<path fill="none" d="M${formatNumber(edge)},${formatNumber(scene.plotArea.y)}V${formatNumber(scene.plotArea.y + scene.plotArea.height)}"/>`,
    );
    for (const tick of axis.ticks) {
      if (horizontal) {
        const direction = axis.orientation === "top" ? -1 : 1;
        const anchor = "middle";
        content.push(
          `<path fill="none" d="M${formatNumber(tick.position)},${formatNumber(edge)}v${formatNumber(direction * 4)}"/>`,
          `<text stroke="none" text-anchor="${anchor}" x="${formatNumber(tick.position)}" y="${formatNumber(edge + direction * 14)}">${escapeXml(tick.label)}</text>`,
        );
      } else {
        const direction = axis.orientation === "left" ? -1 : 1;
        content.push(
          `<path fill="none" d="M${formatNumber(edge)},${formatNumber(tick.position)}h${formatNumber(direction * 4)}"/>`,
          `<text stroke="none" dominant-baseline="middle" text-anchor="${direction < 0 ? "end" : "start"}" x="${formatNumber(edge + direction * 7)}" y="${formatNumber(tick.position)}">${escapeXml(tick.label)}</text>`,
        );
      }
    }
    if (axis.label) {
      if (horizontal) {
        const y =
          axis.orientation === "top"
            ? Math.max(8, scene.plotArea.y - 30)
            : Math.min(scene.height - 8, scene.plotArea.y + scene.plotArea.height + 30);
        content.push(
          `<text stroke="none" text-anchor="middle" dominant-baseline="middle" x="${formatNumber(scene.plotArea.x + scene.plotArea.width / 2)}" y="${formatNumber(y)}">${escapeXml(axis.label)}</text>`,
        );
      } else {
        const x =
          axis.orientation === "left"
            ? Math.max(8, scene.plotArea.x - 43)
            : Math.min(scene.width - 8, scene.plotArea.x + scene.plotArea.width + 43);
        const y = scene.plotArea.y + scene.plotArea.height / 2;
        content.push(
          `<text stroke="none" text-anchor="middle" dominant-baseline="middle" transform="translate(${formatNumber(x)} ${formatNumber(y)}) rotate(${axis.orientation === "left" ? -90 : 90})">${escapeXml(axis.label)}</text>`,
        );
      }
    }
  }
  content.push("</g>");
  if (options.includeOverlays && options.overlays) {
    content.push(serializeInteractionOverlay(scene, theme, options.overlays));
  }
  content.push("</svg>");
  return content.join("");
}

function serializeMark<Row>(mark: SceneMark<Row>, theme: PlotTheme, selected: boolean): string {
  const fill = escapeXml(resolvePaint(mark.fill, theme));
  const stroke = escapeXml(selected ? theme.selectionBorder : resolvePaint(mark.stroke, theme));
  const selection = selected ? ' data-selected="true" stroke-width="2.5"' : "";
  const common = ` fill="${fill}" stroke="${stroke}" opacity="${formatNumber(mark.opacity)}"${selection}`;
  const title = mark.title ? `<title>${escapeXml(mark.title)}</title>` : "";
  switch (mark.kind) {
    case "bar":
    case "cell":
    case "rect":
      return `<path data-mark="${mark.kind}" d="${roundedRectPath(mark.x, mark.y, mark.width, mark.height, mark.radius)}"${common}>${title}</path>`;
    case "line":
      return `<path data-mark="line" d="${segmentedLinePath(mark.segments, mark.curve)}" fill="none" stroke="${stroke}" stroke-width="${formatNumber(selected ? Math.max(2.5, mark.strokeWidth) : mark.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" opacity="${formatNumber(mark.opacity)}"${selected ? ' data-selected="true"' : ""}>${title}</path>`;
    case "area":
      return `<path data-mark="area" d="${areaPath(mark.points, mark.baseline, mark.curve)}"${common}>${title}</path>`;
    case "point":
      if (mark.shape === "square") {
        return `<rect data-mark="point" x="${formatNumber(mark.x - mark.radius)}" y="${formatNumber(mark.y - mark.radius)}" width="${formatNumber(mark.radius * 2)}" height="${formatNumber(mark.radius * 2)}"${common}>${title}</rect>`;
      }
      if (mark.shape === "diamond") {
        const points = [
          `${formatNumber(mark.x)},${formatNumber(mark.y - mark.radius)}`,
          `${formatNumber(mark.x + mark.radius)},${formatNumber(mark.y)}`,
          `${formatNumber(mark.x)},${formatNumber(mark.y + mark.radius)}`,
          `${formatNumber(mark.x - mark.radius)},${formatNumber(mark.y)}`,
        ].join(" ");
        return `<polygon data-mark="point" points="${points}"${common}>${title}</polygon>`;
      }
      return `<circle data-mark="point" cx="${formatNumber(mark.x)}" cy="${formatNumber(mark.y)}" r="${formatNumber(mark.radius)}"${common}>${title}</circle>`;
    case "arc":
      return `<path data-mark="arc" d="${arcPath(mark)}"${common}>${title}</path>`;
    case "rule":
      return `<path data-mark="rule" d="M${formatNumber(mark.x1)},${formatNumber(mark.y1)}L${formatNumber(mark.x2)},${formatNumber(mark.y2)}" fill="none" stroke="${stroke}" stroke-width="${formatNumber(selected ? Math.max(2.5, mark.strokeWidth) : mark.strokeWidth)}" stroke-dasharray="${mark.dash.map(formatNumber).join(" ")}" opacity="${formatNumber(mark.opacity)}"${selected ? ' data-selected="true"' : ""}>${title}</path>`;
    case "text":
      return `<text data-mark="text" x="${formatNumber(mark.x)}" y="${formatNumber(mark.y)}" fill="${fill}" stroke="none" opacity="${formatNumber(mark.opacity)}" text-anchor="${svgTextAnchor(mark.align)}" dominant-baseline="${svgBaseline(mark.baseline)}" style="font:${escapeXml(mark.font ?? theme.font)}">${title}${escapeXml(mark.text)}</text>`;
  }
}

function serializeInteractionOverlay<Row>(
  scene: PlotScene<Row>,
  theme: PlotTheme,
  overlays: PlotInteractionOverlayState,
): string {
  const content = ['<g data-plot-overlays="true" fill="none">'];
  if (overlays.crosshair) {
    const { x, y, axes } = overlays.crosshair;
    if (axes.includes("x")) {
      content.push(
        `<path d="M${formatNumber(x)},0V${formatNumber(scene.height)}" stroke="${escapeXml(theme.crosshair)}" stroke-dasharray="3 3"/>`,
      );
    }
    if (axes.includes("y")) {
      content.push(
        `<path d="M0,${formatNumber(y)}H${formatNumber(scene.width)}" stroke="${escapeXml(theme.crosshair)}" stroke-dasharray="3 3"/>`,
      );
    }
  }
  if (overlays.brush) {
    const x = Math.min(overlays.brush.x0, overlays.brush.x1);
    const y = Math.min(overlays.brush.y0, overlays.brush.y1);
    content.push(
      `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(Math.abs(overlays.brush.x1 - overlays.brush.x0))}" height="${formatNumber(Math.abs(overlays.brush.y1 - overlays.brush.y0))}" fill="${escapeXml(theme.selection)}" stroke="${escapeXml(theme.selectionBorder)}"/>`,
    );
  }
  if (overlays.focus) {
    content.push(
      `<circle cx="${formatNumber(overlays.focus.x)}" cy="${formatNumber(overlays.focus.y)}" r="${formatNumber(overlays.focus.radius ?? 6)}" stroke="${escapeXml(theme.focus)}" stroke-width="2"/>`,
    );
  }
  content.push("</g>");
  return content.join("");
}

function svgTextAnchor(align: CanvasTextAlign): string {
  return align === "center" ? "middle" : align === "right" || align === "end" ? "end" : "start";
}

function svgBaseline(baseline: CanvasTextBaseline): string {
  if (baseline === "middle") return "middle";
  if (baseline === "top" || baseline === "hanging") return "text-before-edge";
  if (baseline === "bottom" || baseline === "ideographic") return "text-after-edge";
  return "alphabetic";
}

export function serializePlotData<Row>(
  scene: PlotScene<Row>,
  options: PlotDataExportOptions = {},
  selectedKeys: ReadonlySet<PlotKey> = new Set(),
): string {
  const rowSource = options.rows ?? "source";
  const scope = options.scope ?? "all";
  const transformed = [
    ...new Map(scene.transformedRows.map((record) => [record.key, record])).values(),
  ];
  const records =
    rowSource === "source"
      ? sourceExportRecords(scene, transformed, scope, selectedKeys)
      : transformed
          .filter((record) => {
            if (scope === "visible" && !record.visible) return false;
            if (
              scope === "selected" &&
              !selectedKeys.has(record.key) &&
              !record.sourceKeys.some((key) => selectedKeys.has(key))
            )
              return false;
            return true;
          })
          .map((record) => ({ ...toRecord(record.row), ...record.values }));
  if ((options.format ?? "csv") === "json") {
    return JSON.stringify(records, jsonReplacer, 2);
  }
  return toCsv(records);
}

function sourceExportRecords<Row>(
  scene: PlotScene<Row>,
  transformed: PlotScene<Row>["transformedRows"],
  scope: NonNullable<PlotDataExportOptions["scope"]>,
  selectedKeys: ReadonlySet<PlotKey>,
): Record<string, unknown>[] {
  const selectedSourceKeys = new Set(selectedKeys);
  for (const record of transformed) {
    if (!selectedKeys.has(record.key)) continue;
    for (const key of record.sourceKeys) selectedSourceKeys.add(key);
  }

  return scene.sourceRowRecords
    .filter((record) => {
      if (scope === "visible" && !record.visible) return false;
      if (scope === "selected" && !selectedSourceKeys.has(record.key)) return false;
      return true;
    })
    .map((record) => toRecord(record.row));
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

function toCsv(records: readonly Record<string, unknown>[]): string {
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  const rows = [
    headers.map((header) => csvCell(neutralizeSpreadsheetFormula(header, header))).join(","),
  ];
  for (const record of records) {
    rows.push(
      headers
        .map((header) => {
          const value = record[header];
          return csvCell(neutralizeSpreadsheetFormula(value, formatCell(value)));
        })
        .join(","),
    );
  }
  return rows.join("\r\n");
}

function neutralizeSpreadsheetFormula(value: unknown, formatted: string): string {
  return typeof value === "string" && /^[\t\r\n ]*[=+\-@]/.test(value)
    ? `'${formatted}`
    : formatted;
}

function formatCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value, jsonReplacer);
  if (typeof value === "number" && !Number.isFinite(value)) return "";
  return String(value);
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

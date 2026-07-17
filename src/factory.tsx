import { state } from "@askrjs/askr";
import type { JSXElement } from "@askrjs/askr/jsx-runtime";
import { compilePlotScene } from "./compiler";
import {
  createPlotController,
  type PlotController,
  type PlotRuntimeConfig,
  type PlotRuntimeSnapshot,
} from "./controller";
import { collectPlotDescriptors, createDescriptorComponent } from "./descriptors";
import type { FollowLatest, PlotFactory, PlotKey, RootProps } from "./model";
import { trimPlotRows } from "./rows";
import type { PlotScene, SceneExportRow, SceneLegend } from "./scene-model";

interface RootHolder<Row> {
  config: PlotRuntimeConfig<Row> | null;
  controller: PlotController<Row> | null;
  runtimeSnapshot: PlotRuntimeSnapshot<Row> | null;
  updateQueued: boolean;
  ref: (element: Element | null) => void;
}

interface PlotExecutionContext {
  readonly ssr?: object;
}

const rootInstanceSlugs = new WeakMap<object, string>();
const ssrRootCounters = new WeakMap<object, number>();
let browserRootCounter = 0;

export function createPlot<Row>(): PlotFactory<Row> {
  const factory = Object.freeze({});
  const Root = ((props: RootProps<Row>, context?: PlotExecutionContext) =>
    renderRoot(factory, props, context)) as PlotFactory<Row>["Root"];
  Object.defineProperty(Root, "name", { configurable: true, value: "PlotRoot" });

  return Object.freeze({
    Root,
    Scale: createDescriptorComponent(factory, "Scale"),
    Axis: createDescriptorComponent(factory, "Axis"),
    Grid: createDescriptorComponent(factory, "Grid"),
    Bar: createDescriptorComponent(factory, "Bar"),
    Line: createDescriptorComponent(factory, "Line"),
    Area: createDescriptorComponent(factory, "Area"),
    Point: createDescriptorComponent(factory, "Point"),
    Arc: createDescriptorComponent(factory, "Arc"),
    Cell: createDescriptorComponent(factory, "Cell"),
    Rect: createDescriptorComponent(factory, "Rect"),
    Rule: createDescriptorComponent(factory, "Rule"),
    Text: createDescriptorComponent(factory, "Text"),
    Legend: createDescriptorComponent(factory, "Legend"),
    Tooltip: createDescriptorComponent(factory, "Tooltip"),
    Crosshair: createDescriptorComponent(factory, "Crosshair"),
    Zoom: createDescriptorComponent(factory, "Zoom"),
    Brush: createDescriptorComponent(factory, "Brush"),
  });
}

function renderRoot<Row>(
  factory: object,
  props: RootProps<Row>,
  context?: PlotExecutionContext,
): JSXElement {
  validateRootProps(props);
  const tableOpen = state(false);
  const holder = state<RootHolder<Row>>(createRootHolder<Row>())();
  const sourceRows = resolveData(props.data);
  const rows = applyFollowLatest(sourceRows, props.followLatest);
  const descriptors = collectPlotDescriptors(factory, props.children);
  const width = Math.max(1, finiteOr(props.width, 640));
  const height = Math.max(1, finiteOr(props.height, 320));
  const sceneWidth = width;
  const sceneHeight = height;
  const semanticScene = compilePlotScene({
    rows,
    rowKey: props.rowKey,
    label: props.label,
    descriptors,
    width: sceneWidth,
    height: sceneHeight,
    view: props.view ?? props.defaultView,
    summary: props.summary,
    locale: props.locale,
  });
  holder.config = Object.freeze({ sourceRows, descriptors, props, initialScene: semanticScene });
  queueControllerUpdate(holder);

  const slug = resolveRootSlug(tableOpen, props.id, props.label, context?.ssr);
  const titleId = `${slug}-title`;
  const descriptionId = `${slug}-description`;
  const summaryId = `${slug}-summary`;
  const instructionsId = `${slug}-instructions`;
  const tooltipId = `${slug}-tooltip`;
  const emptyId = `${slug}-empty`;
  const frameDescription = [
    props.title ? titleId : null,
    props.description ? descriptionId : null,
    semanticScene.empty ? emptyId : null,
    summaryId,
    instructionsId,
    tooltipId,
  ]
    .filter(Boolean)
    .join(" ");
  const rootClass = ["ak-plot-root", props.class].filter(Boolean).join(" ");
  const frameStyle = props.height == null ? undefined : { "--ak-chart-height": `${height}px` };
  const columns = tableOpen() ? tableColumns(semanticScene.transformedRows, sourceRows) : [];
  const tableRows = tableOpen()
    ? semanticScene.transformedRows.length > 0
      ? semanticScene.transformedRows
      : sourceFallbackRows(sourceRows, props.rowKey)
    : [];
  const capturesTouchGestures = Boolean(
    semanticScene.interactions.zoom?.pinch ||
    semanticScene.interactions.zoom?.pan ||
    semanticScene.interactions.brush?.modifier === "none",
  );
  const inspectable = semanticScene.hits.length > 0;
  const meter = props.meter;

  return (
    <section
      id={props.id}
      data-slot="plot-root"
      data-interactive={capturesTouchGestures ? "true" : "false"}
      className={rootClass}
      style={props.style}
      aria-labelledby={props.title ? titleId : undefined}
    >
      {props.title || props.description ? (
        <header data-slot="plot-header" className="ak-plot-header">
          {props.title ? renderHeading(props.title, titleId, props.headingLevel ?? 2) : null}
          {props.description ? (
            <p id={descriptionId} data-slot="plot-description" className="ak-plot-description">
              {props.description}
            </p>
          ) : null}
        </header>
      ) : null}

      <div data-slot="plot-body" className="ak-plot-body">
        {renderLegendRegion(semanticScene.legends, "top", props.label, holder)}
        {renderLegendRegion(semanticScene.legends, "left", props.label, holder)}
        <div ref={holder.ref} data-slot="plot-frame" className="ak-plot-frame" style={frameStyle}>
          <div
            data-slot="plot-graphic"
            className="ak-plot-graphic"
            role={meter?.role ?? (inspectable ? "group" : "img")}
            tabIndex={inspectable ? 0 : undefined}
            aria-label={props.label}
            aria-describedby={frameDescription}
            aria-valuemin={meter?.min}
            aria-valuemax={meter?.max}
            aria-valuenow={meter?.value}
            aria-valuetext={meter?.valueText}
          >
            <canvas
              data-slot="plot-canvas-base"
              className="ak-plot-canvas ak-plot-canvas-base"
              width={sceneWidth}
              height={sceneHeight}
              aria-hidden="true"
            />
            <canvas
              data-slot="plot-canvas-overlay"
              className="ak-plot-canvas ak-plot-canvas-overlay"
              width={sceneWidth}
              height={sceneHeight}
              aria-hidden="true"
            />
          </div>
          <div
            id={emptyId}
            data-slot="plot-empty-state"
            className="ak-plot-empty-state"
            hidden={!semanticScene.empty}
          >
            {props.empty ?? "No data is available for this plot."}
          </div>
          <div
            id={tooltipId}
            data-slot="plot-tooltip"
            className="ak-plot-tooltip"
            role="tooltip"
            aria-live="polite"
            aria-hidden="true"
            hidden
          />
        </div>
        {renderLegendRegion(semanticScene.legends, "right", props.label, holder)}
        {renderLegendRegion(semanticScene.legends, "bottom", props.label, holder)}
      </div>

      <p id={summaryId} data-slot="plot-summary" className="ak-plot-summary">
        {semanticScene.summary}
      </p>
      <p
        id={instructionsId}
        data-slot="plot-instructions"
        data-plot-visually-hidden="true"
        className="ak-plot-instructions ak-plot-sr-only"
      >
        {plotInstructions(semanticScene, Boolean(props.onActivate))}
      </p>
      {props.followLatest ? (
        <p
          data-slot="plot-live-status"
          data-following="true"
          className="ak-plot-live-status"
          aria-live="polite"
        >
          Following the latest rows.
        </p>
      ) : null}

      <div data-slot="plot-controls" className="ak-plot-controls">
        {semanticScene.interactions.zoom ? (
          <button
            type="button"
            data-slot="plot-control"
            className="ak-plot-control"
            onClick={() => holder.controller?.resetView()}
          >
            Reset view
          </button>
        ) : null}
        {props.followLatest ? (
          <button
            type="button"
            data-slot="plot-control"
            className="ak-plot-control"
            onClick={() => holder.controller?.resumeLive()}
          >
            Resume live
          </button>
        ) : null}
        <button
          type="button"
          data-slot="plot-data-toggle"
          className="ak-plot-control ak-plot-data-toggle"
          aria-expanded={tableOpen()}
          aria-controls={`${slug}-data`}
          onClick={() => tableOpen.set((open) => !open)}
        >
          {tableOpen() ? "Hide data" : "View data"}
        </button>
      </div>

      {tableOpen() ? (
        <div id={`${slug}-data`} data-slot="plot-data-panel" className="ak-plot-data-panel">
          <table data-slot="plot-data-table" className="ak-plot-data-table">
            <caption>{props.label} transformed data</caption>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((record, index) => (
                <tr key={`${String(record.key)}-${index}`}>
                  {columns.map((column, columnIndex) =>
                    columnIndex === 0 ? (
                      <th key={column} scope="row">
                        {formatCell(tableValue(record, column))}
                      </th>
                    ) : (
                      <td key={column}>{formatCell(tableValue(record, column))}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function renderHeading(
  title: string,
  id: string,
  level: NonNullable<RootProps<unknown>["headingLevel"]>,
) {
  const attributes = { id, "data-slot": "plot-title", className: "ak-plot-title" };
  switch (level) {
    case 1:
      return <h1 {...attributes}>{title}</h1>;
    case 2:
      return <h2 {...attributes}>{title}</h2>;
    case 3:
      return <h3 {...attributes}>{title}</h3>;
    case 4:
      return <h4 {...attributes}>{title}</h4>;
    case 5:
      return <h5 {...attributes}>{title}</h5>;
    case 6:
      return <h6 {...attributes}>{title}</h6>;
  }
}

function plotInstructions<Row>(scene: PlotScene<Row>, canActivate: boolean): string {
  const instructions: string[] = [];
  if (scene.hits.length > 0) {
    instructions.push("Use the arrow keys to inspect marks.");
    if (canActivate) {
      instructions.push("Press Enter or Space to activate a focused mark.");
    }
    if (scene.interactions.brush) {
      instructions.push("Press Shift+Space to add or remove a focused mark from the selection.");
    }
    if (scene.interactions.zoom) {
      instructions.push("Use the plus and minus keys to zoom and Home to reset the view.");
      if (scene.interactions.zoom.pan) {
        instructions.push("Use Shift plus the arrow keys to pan.");
      }
    }
  }
  instructions.push("Use the View data control for a table.");
  return instructions.join(" ");
}

function validateRootProps<Row>(props: RootProps<Row>): void {
  if (typeof props.label !== "string" || props.label.trim() === "") {
    throw new TypeError("Plot.Root label must be a non-blank string.");
  }
  if (
    props.id !== undefined &&
    (typeof props.id !== "string" || props.id.trim() === "" || /\s/.test(props.id))
  ) {
    throw new TypeError("Plot.Root id must be non-blank and must not contain whitespace.");
  }
  if (
    props.headingLevel !== undefined &&
    (!Number.isInteger(props.headingLevel) || props.headingLevel < 1 || props.headingLevel > 6)
  ) {
    throw new RangeError("Plot.Root headingLevel must be an integer from 1 through 6.");
  }
  for (const [name, value] of [
    ["width", props.width],
    ["height", props.height],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      throw new RangeError(`Plot.Root ${name} must be a finite positive number.`);
    }
  }
  if (props.meter) {
    const { min, max, value } = props.meter;
    if (![min, max, value].every(Number.isFinite)) {
      throw new RangeError("Plot.Root meter values must be finite numbers.");
    }
    if (max <= min) {
      throw new RangeError("Plot.Root meter max must be greater than min.");
    }
    if (value < min || value > max) {
      throw new RangeError("Plot.Root meter value must be within min and max.");
    }
  }
}

function renderLegendRegion<Row>(
  legends: readonly SceneLegend[],
  position: SceneLegend["position"],
  plotLabel: string,
  holder: RootHolder<Row>,
): JSXElement | null {
  const positioned = legends
    .map((legend, index) => ({ legend, index }))
    .filter(({ legend }) => legend.position === position);
  if (positioned.length === 0) return null;

  return (
    <div data-slot="plot-legends" data-plot-legend-position={position} className="ak-plot-legends">
      {positioned.map(({ legend, index }) => (
        <div
          key={`${legend.scale}-${index}`}
          data-slot="plot-legend"
          className="ak-plot-legend"
          role="group"
          aria-label={legend.label ?? `${plotLabel} legend`}
        >
          {legend.label ? (
            <p data-slot="plot-legend-title" className="ak-plot-legend-title">
              {legend.label}
            </p>
          ) : null}
          <ul data-slot="plot-legend-list" className="ak-plot-legend-list">
            {legend.items.map((item) => (
              <li key={item.value}>
                {legend.interactive ? (
                  <button
                    type="button"
                    data-slot="plot-legend-item"
                    data-plot-series={item.value}
                    className="ak-plot-legend-item"
                    aria-pressed="true"
                    onClick={() => holder.controller?.toggleSeries(item.value)}
                  >
                    <span
                      data-slot="plot-legend-swatch"
                      className="ak-plot-legend-swatch"
                      style={{ "--ak-chart-series-color": item.color }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </button>
                ) : (
                  <span data-slot="plot-legend-item" className="ak-plot-legend-item">
                    <span
                      data-slot="plot-legend-swatch"
                      className="ak-plot-legend-swatch"
                      style={{ "--ak-chart-series-color": item.color }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function resolveRootSlug(
  instance: object,
  explicitId: string | undefined,
  label: string,
  ssrContext: object | undefined,
): string {
  if (explicitId !== undefined) return explicitId;
  const existing = rootInstanceSlugs.get(instance);
  if (existing) return existing;

  const ordinal = ssrContext
    ? (ssrRootCounters.get(ssrContext) ?? 0) + 1
    : (browserRootCounter += 1);
  if (ssrContext) ssrRootCounters.set(ssrContext, ordinal);
  const slug = `plot-${slugify(label)}-${ordinal}`;
  rootInstanceSlugs.set(instance, slug);
  return slug;
}

function createRootHolder<Row>(): RootHolder<Row> {
  const holder = {
    config: null,
    controller: null,
    runtimeSnapshot: null,
    updateQueued: false,
    ref: (_element: Element | null) => undefined,
  } as RootHolder<Row>;
  holder.ref = (element) => {
    if (element === null) {
      holder.runtimeSnapshot = holder.controller?.runtimeSnapshot ?? holder.runtimeSnapshot;
      holder.controller?.destroy();
      holder.controller = null;
      return;
    }
    if (!(element instanceof HTMLElement) || !holder.config) return;
    if (holder.controller) holder.controller.update(holder.config);
    else {
      const runtimeSnapshot = holder.runtimeSnapshot;
      holder.runtimeSnapshot = null;
      holder.controller = createPlotController(
        element,
        runtimeSnapshot
          ? Object.freeze({
              ...holder.config,
              transitionFromScene: runtimeSnapshot.scene,
              runtimeSnapshot,
            })
          : holder.config,
      );
    }
  };
  return holder;
}

function queueControllerUpdate<Row>(holder: RootHolder<Row>): void {
  if (!holder.controller || !holder.config || holder.updateQueued) return;
  holder.updateQueued = true;
  const queuedController = holder.controller;
  queueMicrotask(() => {
    holder.updateQueued = false;
    if (holder.controller === queuedController && holder.config) {
      holder.controller.update(holder.config);
    }
  });
}

function resolveData<Row>(data: RootProps<Row>["data"]): readonly Row[] {
  const rows = typeof data === "function" ? data() : data;
  if (!Array.isArray(rows)) throw new TypeError("Plot.Root data must resolve to a readonly array.");
  return rows;
}

function applyFollowLatest<Row>(
  rows: readonly Row[],
  follow: FollowLatest<Row> | undefined,
): readonly Row[] {
  if (follow == null) return rows;
  if (typeof follow === "number") return trimPlotRows(rows, follow);
  if ("rows" in follow) return trimPlotRows(rows, follow.rows);
  return trimPlotRows(rows, { durationMs: follow.durationMs, field: follow.field });
}

function tableColumns<Row>(
  records: readonly SceneExportRow<Row>[],
  rows: readonly Row[],
): string[] {
  const columns: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  };
  for (const record of records) {
    add(record.row);
    add(record.values);
  }
  if (records.length === 0) for (const row of rows) add(row);
  return columns.length > 0 ? columns : ["value"];
}

function sourceFallbackRows<Row>(
  rows: readonly Row[],
  rowKey: RootProps<Row>["rowKey"],
): readonly SceneExportRow<Row>[] {
  return rows.map((row, index) => {
    const key = readFallbackKey(row, index, rowKey);
    return {
      row,
      key,
      sourceIndex: index,
      sourceKeys: Object.freeze([key]),
      visible: true,
      values: Object.freeze({}),
    };
  });
}

function readFallbackKey<Row>(row: Row, index: number, rowKey: RootProps<Row>["rowKey"]): PlotKey {
  const value =
    typeof rowKey === "function" ? rowKey(row, index) : (row as Record<string, unknown>)[rowKey];
  return typeof value === "string" || typeof value === "number" ? value : index;
}

function tableValue<Row>(record: SceneExportRow<Row>, column: string): unknown {
  if (column in record.values) return record.values[column];
  if (typeof record.row === "object" && record.row !== null) {
    return (record.row as Record<string, unknown>)[column];
  }
  return column === "value" ? record.row : undefined;
}

function formatCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number" && !Number.isFinite(value)) return "";
  return String(value);
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "chart"
  );
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

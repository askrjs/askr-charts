import { For } from "@askrjs/askr";
import { clampChartValue, formatChartValue } from "../../core";
import { cx } from "../_internal/classnames";
import {
  createChartId,
  mergeChartStyles,
  resolveChartAnimation,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { FlameGraphDatum, FlameGraphProps } from "./flame-graph.types";

interface PreparedFlameGraphDatum extends FlameGraphDatum {
  children: PreparedFlameGraphDatum[];
  formattedValue: string;
  value: number;
  spanValue: number;
}

interface FlattenedFlameGraphDatum {
  color?: string;
  depth: number;
  description?: string;
  formattedValue: string;
  itemIndex: number;
  label: string;
  parentLabel?: string;
  path: string;
  spanValue: number;
  startFraction: number;
  value: number;
  widthFraction: number;
}

function prepareFlameGraphData(
  data: readonly FlameGraphDatum[],
  formatter?: (value: number) => string,
): PreparedFlameGraphDatum[] {
  return data.map((datum) => {
    const children = prepareFlameGraphData(datum.children ?? [], formatter);
    const value = clampChartValue(datum.value);
    const childSpan = children.reduce((sum, child) => sum + child.spanValue, 0);

    return {
      ...datum,
      children,
      formattedValue: formatChartValue(value, formatter),
      value,
      spanValue: Math.max(value, childSpan),
    };
  });
}

function flattenFlameGraphData(
  data: readonly PreparedFlameGraphDatum[],
  total: number,
): FlattenedFlameGraphDatum[] {
  const flattened: FlattenedFlameGraphDatum[] = [];
  let itemIndex = 0;

  function visit(
    nodes: readonly PreparedFlameGraphDatum[],
    depth: number,
    startValue: number,
    parentPath?: string,
    parentLabel?: string,
  ) {
    let cursor = startValue;

    for (const node of nodes) {
      const path = parentPath ? `${parentPath} > ${node.label}` : node.label;
      flattened.push({
        color: node.color,
        depth,
        description: node.description,
        formattedValue: node.formattedValue,
        itemIndex: itemIndex++,
        label: node.label,
        parentLabel,
        path,
        spanValue: node.spanValue,
        startFraction: total > 0 ? cursor / total : 0,
        value: node.value,
        widthFraction: total > 0 ? node.spanValue / total : 0,
      });

      if (node.children.length > 0) {
        visit(node.children, depth + 1, cursor, path, node.label);
      }

      cursor += node.spanValue;
    }
  }

  visit(data, 0, 0);

  return flattened;
}

function groupFlameGraphRows(data: readonly FlattenedFlameGraphDatum[]) {
  const rows = new Map<number, FlattenedFlameGraphDatum[]>();

  for (const datum of data) {
    const row = rows.get(datum.depth);
    if (row) {
      row.push(datum);
    } else {
      rows.set(datum.depth, [datum]);
    }
  }

  return [...rows.entries()]
    .sort(([left], [right]) => left - right)
    .map(([depth, frames]) => ({ depth, frames }));
}

export function FlameGraph({
  animate,
  animation,
  className,
  data,
  id,
  label,
  labelDensity = "full",
  max,
  style,
  summary,
  valueFormatter,
  ...rest
}: FlameGraphProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "grow",
  });
  const formatter = resolveValueFormatter(valueFormatter);
  const prepared = prepareFlameGraphData(data, formatter);
  const detectedTotal = prepared.reduce((sum, datum) => sum + datum.spanValue, 0);
  const total = Math.max(clampChartValue(max ?? 0), detectedTotal, 1);
  const flattened = flattenFlameGraphData(prepared, total);
  const rows = groupFlameGraphRows(flattened);
  const summaryId = createChartId("flame-graph-summary", id ?? label);
  const tableId = createChartId("flame-graph-table", id ?? label);
  const dominantFrame =
    flattened.length === 0
      ? undefined
      : flattened.reduce(
          (best, datum) => (datum.spanValue > best.spanValue ? datum : best),
          flattened[0]!,
        );
  const defaultSummary =
    flattened.length === 0
      ? `${label}. No flame graph frames available.`
      : `${label}. ${flattened.length} frames across ${rows.length} levels. Widest frame is ${dominantFrame?.path ?? ""} at ${formatChartValue(dominantFrame?.spanValue ?? 0, formatter)}. Total span is ${formatChartValue(total, formatter)}.`;

  return (
    <section
      {...rest}
      id={id}
      {...animationAttrs}
      data-ak-label-density={labelDensity}
      data-slot="flame-graph"
      className={cx("ak-chart", "ak-flame-graph", className)}
      style={mergeChartStyles(
        {
          "--ak-flame-graph-depth": rows.length,
          ...animationStyle,
        },
        style,
      )}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-flame-graph-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <div data-slot="flame-graph-stack" className="ak-flame-graph-stack">
          <For each={rows} by={(row) => row.depth}>
            {(row) => (
              <ol data-slot="flame-graph-row" className="ak-flame-graph-row">
                <For each={row.frames} by={(frame) => `${frame.path}-${frame.itemIndex}`}>
                  {(frame) => (
                    <li
                      data-ak-chart-item="true"
                      data-ak-chart-tooltip-trigger="true"
                      data-slot="flame-graph-cell"
                      className="ak-flame-graph-cell"
                      aria-label={`${frame.path}: ${frame.formattedValue}`}
                      tabIndex={0}
                      style={mergeChartStyles({
                        "--ak-chart-item-color":
                          frame.color ?? `var(--ak-chart-series-${(frame.depth % 6) + 1})`,
                        "--ak-chart-item-index": frame.itemIndex,
                        "--ak-chart-item-offset": `${frame.startFraction * 100}%`,
                        "--ak-chart-item-value": `${frame.widthFraction * 100}%`,
                      })}
                    >
                      <span data-slot="flame-graph-label" className="ak-flame-graph-label">
                        {frame.label}
                      </span>
                      <span data-slot="flame-graph-value" className="ak-flame-graph-value">
                        {frame.formattedValue}
                      </span>
                      <span data-slot="chart-tooltip" className="chart-tooltip" role="tooltip">
                        <span data-slot="chart-tooltip-title" className="chart-tooltip-title">
                          {frame.path}
                        </span>
                        <span data-slot="chart-tooltip-value" className="chart-tooltip-value">
                          {frame.formattedValue}
                        </span>
                        {frame.description ? <span>{frame.description}</span> : null}
                      </span>
                    </li>
                  )}
                </For>
              </ol>
            )}
          </For>
        </div>
      </div>

      <p id={summaryId} data-slot="chart-summary" className="ak-chart-summary">
        {summary ?? defaultSummary}
      </p>

      <table id={tableId} data-slot="chart-table" className="ak-chart-table ak-chart-sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Frame</th>
            <th scope="col">Level</th>
            <th scope="col">Value</th>
            <th scope="col">Span</th>
            <th scope="col">Parent</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          <For each={flattened} by={(frame) => `${frame.path}-${frame.itemIndex}`}>
            {(frame) => (
              <tr>
                <th scope="row">{frame.path}</th>
                <td>{frame.depth + 1}</td>
                <td>{frame.formattedValue}</td>
                <td>{formatChartValue(frame.spanValue, formatter)}</td>
                <td>{frame.parentLabel ?? ""}</td>
                <td>{frame.description ?? ""}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </section>
  );
}

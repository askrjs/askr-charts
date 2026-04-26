import { For } from "@askrjs/askr";
import { normalizeHeatmapData } from "../../core";
import { cx } from "../_internal/classnames";
import {
  createChartId,
  getHeatmapSummary,
  mergeChartStyles,
  resolveChartAnimation,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { HeatmapProps } from "./heatmap.types";

export function Heatmap({
  animate,
  animation,
  className,
  data,
  id,
  label,
  max,
  style,
  summary,
  valueFormatter,
  ...rest
}: HeatmapProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "fade",
  });
  const normalized = normalizeHeatmapData(data, {
    max,
    valueFormatter: resolveValueFormatter(valueFormatter),
  });
  const summaryId = createChartId("heatmap-summary", id ?? label);
  const tableId = createChartId("heatmap-table", id ?? label);

  return (
    <section
      {...rest}
      id={id}
      {...animationAttrs}
      data-slot="heatmap"
      className={cx("ak-chart", "ak-heatmap", className)}
      style={mergeChartStyles(
        { "--ak-heatmap-columns": normalized.columns.length, ...animationStyle },
        style,
      )}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <div data-slot="heatmap-grid" className="ak-heatmap-grid">
          <span data-slot="heatmap-corner" className="ak-heatmap-corner" aria-hidden="true" />
          <For each={normalized.columns} by={(column) => column}>
            {(column) => (
              <span data-slot="heatmap-column-label" className="ak-heatmap-column-label">
                {column}
              </span>
            )}
          </For>
          <For each={normalized.rows} by={(row) => row}>
            {(row, rowIndex) => (
              <span data-slot="heatmap-row" style={{ display: "contents" }}>
                <span data-slot="heatmap-row-label" className="ak-heatmap-row-label">
                  {row}
                </span>
                <For each={normalized.columns} by={(column) => `${row}-${column}`}>
                  {(column, columnIndex) => {
                    const cell = normalized.cells.find((entry) => entry.x === column && entry.y === row);
                    const cellLabel = `${row}, ${column}`;
                    return (
                      <span
                        data-ak-chart-item="true"
                        data-slot="heatmap-cell"
                        className="ak-heatmap-cell"
                        aria-label={cell ? `${cellLabel}: ${cell.formattedValue}` : `${cellLabel}: 0`}
                        style={mergeChartStyles({
                          "--ak-chart-cell-bg": cell?.background ?? "var(--ak-chart-color-muted)",
                          "--ak-chart-item-index": rowIndex() * normalized.columns.length + columnIndex(),
                        })}
                      >
                        <span className="ak-chart-sr-only">
                          {cell ? `${cellLabel}: ${cell.formattedValue}` : `${cellLabel}: 0`}
                        </span>
                      </span>
                    );
                  }}
                </For>
              </span>
            )}
          </For>
        </div>
      </div>

      <p id={summaryId} data-slot="chart-summary" className="ak-chart-summary">
        {getHeatmapSummary(label, normalized.cells, normalized.max, summary)}
      </p>

      <table id={tableId} data-slot="chart-table" className="ak-chart-table ak-chart-sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Row</th>
            <th scope="col">Column</th>
            <th scope="col">Value</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          <For each={normalized.cells} by={(cell, index) => `${cell.y}-${cell.x}-${index}`}>
            {(cell) => (
              <tr>
                <th scope="row">{cell.y}</th>
                <td>{cell.x}</td>
                <td>{cell.formattedValue}</td>
                <td>{cell.description ?? ""}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </section>
  );
}

import { normalizeHeatmapData } from "../../core";
import { cx } from "../_internal/classnames";
import {
  createChartId,
  getHeatmapSummary,
  mergeChartStyles,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { HeatmapProps } from "./heatmap.types";

export function Heatmap({
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
      data-slot="heatmap"
      className={cx("ak-chart", "ak-heatmap", className)}
      style={mergeChartStyles({ "--ak-heatmap-columns": normalized.columns.length }, style)}
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
          {normalized.columns.map((column) => (
            <span key={column} data-slot="heatmap-column-label" className="ak-heatmap-column-label">
              {column}
            </span>
          ))}
          {normalized.rows.map((row) => [
            <span
              key={`${row}-label`}
              data-slot="heatmap-row-label"
              className="ak-heatmap-row-label"
            >
              {row}
            </span>,
            ...normalized.columns.map((column) => {
              const cell = normalized.cells.find((entry) => entry.x === column && entry.y === row);
              const cellLabel = `${row}, ${column}`;
              return (
                <span
                  key={`${row}-${column}`}
                  data-slot="heatmap-cell"
                  className="ak-heatmap-cell"
                  aria-label={cell ? `${cellLabel}: ${cell.formattedValue}` : `${cellLabel}: 0`}
                  style={mergeChartStyles({
                    "--ak-chart-cell-bg": cell?.background ?? "var(--ak-chart-color-muted)",
                  })}
                >
                  <span className="ak-chart-sr-only">
                    {cell ? `${cellLabel}: ${cell.formattedValue}` : `${cellLabel}: 0`}
                  </span>
                </span>
              );
            }),
          ])}
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
          {normalized.cells.map((cell, index) => (
            <tr key={`${cell.y}-${cell.x}-${index}`}>
              <th scope="row">{cell.y}</th>
              <td>{cell.x}</td>
              <td>{cell.formattedValue}</td>
              <td>{cell.description ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

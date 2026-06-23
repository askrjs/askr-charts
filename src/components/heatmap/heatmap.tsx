import { For } from "@askrjs/askr";
import { formatChartValue, normalizeHeatmapData, type NormalizedHeatmapDatum } from "../../core";
import { cx } from "../_internal/classnames";
import {
  chartTooltipTriggerProps,
  createChartId,
  getHeatmapSummary,
  mergeChartProps,
  mergeChartStyles,
  resolveChartAnimation,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { HeatmapProps } from "./heatmap.types";

interface HeatmapTableRow {
  column: string;
  description: string;
  key: string;
  row: string;
  value: string;
}

export function Heatmap({
  animate,
  animation,
  className,
  data,
  id,
  label,
  min,
  max,
  style,
  summary,
  valueFormatter,
  ...rest
}: HeatmapProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "fade",
  });
  const formatter = resolveValueFormatter(valueFormatter);
  const normalized = normalizeHeatmapData(data, {
    min,
    max,
    valueFormatter: formatter,
  });
  const rowIndexByName: Record<string, number> = Object.create(null);
  const columnIndexByName: Record<string, number> = Object.create(null);

  for (let index = 0; index < normalized.rows.length; index += 1) {
    rowIndexByName[normalized.rows[index]!] = index;
  }

  for (let index = 0; index < normalized.columns.length; index += 1) {
    columnIndexByName[normalized.columns[index]!] = index;
  }

  const cellsByCoordinate: Array<Array<NormalizedHeatmapDatum | undefined>> = [];

  for (let rowIndex = 0; rowIndex < normalized.rows.length; rowIndex += 1) {
    const rowCells: Array<NormalizedHeatmapDatum | undefined> = [];
    rowCells.length = normalized.columns.length;
    cellsByCoordinate[rowIndex] = rowCells;
  }

  for (const cell of normalized.cells) {
    const rowIndex = rowIndexByName[cell.y];
    const columnIndex = columnIndexByName[cell.x];

    if (rowIndex === undefined || columnIndex === undefined) {
      continue;
    }

    cellsByCoordinate[rowIndex]![columnIndex] = cell;
  }

  const formattedZeroValue = formatChartValue(0, formatter);
  const tableRows: HeatmapTableRow[] = [];

  for (let rowIndex = 0; rowIndex < normalized.rows.length; rowIndex += 1) {
    const row = normalized.rows[rowIndex]!;
    const rowCells = cellsByCoordinate[rowIndex];

    for (let columnIndex = 0; columnIndex < normalized.columns.length; columnIndex += 1) {
      const column = normalized.columns[columnIndex]!;
      const cell = rowCells?.[columnIndex];

      tableRows.push({
        column,
        description: cell?.description ?? "",
        key: `${row}-${column}-${rowIndex}-${columnIndex}`,
        row,
        value: cell?.formattedValue ?? formattedZeroValue,
      });
    }
  }

  const summaryId = createChartId("heatmap-summary", id ?? label);
  const tableId = createChartId("heatmap-table", id ?? label);
  const sectionProps = mergeChartProps(rest, chartTooltipTriggerProps);

  return (
    <section
      {...sectionProps}
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
            {(row, rowIndex) => {
              const rowCells = cellsByCoordinate[rowIndex()];

              return (
                <span data-slot="heatmap-row" style={{ display: "contents" }}>
                  <span data-slot="heatmap-row-label" className="ak-heatmap-row-label">
                    {row}
                  </span>
                  <For each={normalized.columns} by={(column) => `${row}-${column}`}>
                    {(column, columnIndex) => {
                      const cell = rowCells?.[columnIndex()];
                      const cellLabel = `${row}, ${column}`;
                      const formattedValue = cell?.formattedValue ?? formattedZeroValue;
                      return (
                        <span
                          data-ak-chart-item="true"
                          data-ak-chart-tooltip-trigger="true"
                          data-slot="heatmap-cell"
                          className="ak-heatmap-cell"
                          aria-label={`${cellLabel}: ${formattedValue}`}
                          tabIndex={0}
                          style={mergeChartStyles({
                            "--ak-chart-cell-bg": cell?.background ?? "var(--ak-chart-color-muted)",
                            "--ak-chart-item-index":
                              rowIndex() * normalized.columns.length + columnIndex(),
                          })}
                        >
                          <span className="ak-chart-sr-only">
                            {cellLabel}: {formattedValue}
                          </span>
                          <span
                            data-slot="tooltip-content"
                            className="chart-tooltip"
                            role="tooltip"
                          >
                            <span className="chart-tooltip-title">{cellLabel}</span>
                            <span className="chart-tooltip-value">{formattedValue}</span>
                            {cell?.description ? <span>{cell.description}</span> : null}
                          </span>
                        </span>
                      );
                    }}
                  </For>
                </span>
              );
            }}
          </For>
        </div>
      </div>

      <p id={summaryId} data-slot="chart-summary" className="ak-chart-summary">
        {getHeatmapSummary(label, normalized.cells, normalized.max, summary, formatter)}
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
          <For each={tableRows} by={(row) => row.key}>
            {(row) => (
              <tr>
                <th scope="row">{row.row}</th>
                <td>{row.column}</td>
                <td>{row.value}</td>
                <td>{row.description}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </section>
  );
}

import { cx } from "../_internal/classnames";
import type { ChartLegendProps } from "./chart-legend.types";

export function ChartLegend({ className, items, style, title, ...rest }: ChartLegendProps) {
  return (
    <aside
      data-slot="chart-legend"
      className={cx("chart-legend", "ak-chart-legend", className)}
      style={style}
      {...rest}
    >
      {title ? (
        <h3 data-slot="chart-legend-title" className="chart-legend-title">
          {title}
        </h3>
      ) : null}

      <ul data-slot="chart-legend-list" className="chart-legend-list">
        {items.map((item) => (
          <li key={item.label} data-slot="chart-legend-item" className="chart-legend-item">
            <span
              aria-hidden="true"
              data-slot="chart-legend-swatch"
              className="chart-legend-swatch"
              style={item.color ? { "--ak-chart-item-color": item.color } : undefined}
            />
            <span data-slot="chart-legend-label" className="chart-legend-label">
              {item.label}
            </span>
            {item.value ? (
              <span data-slot="chart-legend-value" className="chart-legend-value">
                {item.value}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}

import { cx } from "../_internal/classnames";
import type { ChartShellProps } from "./chart-shell.types";

export function ChartShell({
  children,
  className,
  description,
  style,
  title,
  ...rest
}: ChartShellProps) {
  return (
    <section
      data-slot="chart-shell"
      className={cx("chart-shell", "ak-chart-shell", className)}
      style={style}
      {...rest}
    >
      {title || description ? (
        <header data-slot="chart-shell-header" className="chart-shell-header">
          {title ? (
            <h2 data-slot="chart-shell-title" className="chart-shell-title">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p data-slot="chart-shell-description" className="chart-shell-description">
              {description}
            </p>
          ) : null}
        </header>
      ) : null}

      <div data-slot="chart-shell-content" className="chart-shell-content">
        {children}
      </div>
    </section>
  );
}

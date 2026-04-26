import type { ChartValueFormatter, ValueChartDatum } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface DonutChartProps extends ChartVisualBaseProps {
  data: readonly ValueChartDatum[];
  label: string;
  summary?: string;
  totalLabel?: string;
  valueFormatter?: ChartValueFormatter;
}

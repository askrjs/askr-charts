import type { ValueChartDatum, ChartValueFormatter } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface BarChartProps extends ChartVisualBaseProps {
  data: readonly ValueChartDatum[];
  label: string;
  summary?: string;
  max?: number;
  valueFormatter?: ChartValueFormatter;
}

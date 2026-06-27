import type { ChartValueFormatter, ValueChartDatumInput } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface PieChartProps extends ChartVisualBaseProps {
  data: readonly ValueChartDatumInput[];
  label: string;
  summary?: string;
  valueFormatter?: ChartValueFormatter;
}

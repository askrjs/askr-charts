import type { ChartValueFormatter, ValueChartDatumInput } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface DonutChartProps extends ChartVisualBaseProps {
  data: readonly ValueChartDatumInput[];
  label: string;
  summary?: string;
  totalLabel?: string;
  valueFormatter?: ChartValueFormatter;
}

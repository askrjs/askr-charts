import type { ChartValueFormatter, HeatmapDatumInput } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface HeatmapProps extends ChartVisualBaseProps {
  data: readonly HeatmapDatumInput[];
  label: string;
  min?: number;
  summary?: string;
  max?: number;
  valueFormatter?: ChartValueFormatter;
}

import type { ChartValueFormatter, HeatmapDatum } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface HeatmapProps extends ChartVisualBaseProps {
  data: readonly HeatmapDatum[];
  label: string;
  summary?: string;
  max?: number;
  valueFormatter?: ChartValueFormatter;
}

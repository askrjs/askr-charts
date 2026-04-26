import type { ChartVisualBaseProps } from "../_internal/types";

export interface TimelineDatum {
  label: string;
  value?: string;
  description?: string;
  accentColor?: string;
}

export interface TimelineProps extends ChartVisualBaseProps {
  data: readonly TimelineDatum[];
  label: string;
  summary?: string;
}

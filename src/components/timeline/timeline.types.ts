import type { ChartVisualBaseProps } from "../_internal/types";

export type TimelineItemStatus = "default" | "success" | "warning" | "danger" | "info";

export interface TimelineDatum {
  label: string;
  value?: string;
  description?: string;
  accentColor?: string;
  status?: TimelineItemStatus;
}

export interface TimelineProps extends ChartVisualBaseProps {
  data: readonly TimelineDatum[];
  label: string;
  summary?: string;
}

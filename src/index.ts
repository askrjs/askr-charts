export { createPlot } from "./factory";
export {
  bin,
  constant,
  count,
  filterRows,
  group,
  mean,
  movingAverage,
  movingWindow,
  normalize,
  partition,
  regression,
  sortRows,
  stack,
  sum,
} from "./expressions";
export { appendPlotRows, removePlotRows, trimPlotRows, upsertPlotRows } from "./rows";

export type * from "./model";
export type { TrimPlotRowsOptions } from "./rows";

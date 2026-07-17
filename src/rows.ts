import type { PlotKey, PlotRowKey, RowAccessor, RowField } from "./model";

export function readRowKey<Row>(
  row: Readonly<Row>,
  index: number,
  rowKey: PlotRowKey<Row>,
): PlotKey {
  const value =
    typeof rowKey === "function" ? rowKey(row, index) : (row as Record<string, unknown>)[rowKey];

  if (typeof value !== "string" && typeof value !== "number") {
    throw new TypeError(
      `Plot row keys must be strings or numbers; received ${String(value)} at row ${index}.`,
    );
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError(`Plot row keys must be finite; received ${String(value)} at row ${index}.`);
  }

  return value;
}

export function appendPlotRows<Row>(
  rows: readonly Row[],
  appended: readonly Row[] | Row,
): readonly Row[] {
  const additions = Array.isArray(appended) ? appended : [appended];
  return additions.length === 0 ? rows : Object.freeze([...rows, ...additions]);
}

export function upsertPlotRows<Row>(
  rows: readonly Row[],
  updates: readonly Row[] | Row,
  rowKey: PlotRowKey<Row>,
): readonly Row[] {
  const incoming = Array.isArray(updates) ? updates : [updates];
  if (incoming.length === 0) return rows;

  const positions = new Map<PlotKey, number>();
  for (let index = 0; index < rows.length; index += 1) {
    const key = readRowKey(rows[index]!, index, rowKey);
    if (positions.has(key)) {
      throw new Error(`Duplicate plot row key ${String(key)} in existing rows.`);
    }
    positions.set(key, index);
  }

  const result = [...rows];
  const incomingKeys = new Set<PlotKey>();
  for (let index = 0; index < incoming.length; index += 1) {
    const row = incoming[index]!;
    const key = readRowKey(row, index, rowKey);
    if (incomingKeys.has(key)) {
      throw new Error(`Duplicate plot row key ${String(key)} in upsert rows.`);
    }
    incomingKeys.add(key);
    const position = positions.get(key);
    if (position === undefined) {
      positions.set(key, result.length);
      result.push(row);
    } else {
      result[position] = row;
    }
  }

  return Object.freeze(result);
}

export function removePlotRows<Row>(
  rows: readonly Row[],
  keys:
    | readonly PlotKey[]
    | ReadonlySet<PlotKey>
    | ((row: Readonly<Row>, index: number) => boolean),
  rowKey?: PlotRowKey<Row>,
): readonly Row[] {
  let shouldRemove: (row: Readonly<Row>, index: number) => boolean;

  if (typeof keys === "function") {
    shouldRemove = keys;
  } else {
    if (!rowKey) {
      throw new TypeError("removePlotRows requires rowKey when removing by key.");
    }
    const keySet = keys instanceof Set ? keys : new Set(keys);
    shouldRemove = (row, index) => keySet.has(readRowKey(row, index, rowKey));
  }

  let changed = false;
  const kept: Row[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    if (shouldRemove(row, index)) {
      changed = true;
    } else {
      kept.push(row);
    }
  }

  return changed ? Object.freeze(kept) : rows;
}

export type TrimPlotRowsOptions<Row> =
  | { rows: number }
  | {
      durationMs: number;
      field: RowField<Row> | RowAccessor<Row, Date>;
      now?: Date | number;
    };

export function trimPlotRows<Row>(
  rows: readonly Row[],
  options: number | TrimPlotRowsOptions<Row>,
): readonly Row[] {
  const normalized = typeof options === "number" ? { rows: options } : options;

  if ("rows" in normalized) {
    const limit = Math.max(0, Math.floor(normalized.rows));
    if (rows.length <= limit) return rows;
    return Object.freeze(rows.slice(rows.length - limit));
  }

  if (!Number.isFinite(normalized.durationMs) || normalized.durationMs < 0) {
    throw new RangeError("trimPlotRows durationMs must be a finite non-negative number.");
  }

  const latest =
    normalized.now instanceof Date
      ? normalized.now.getTime()
      : typeof normalized.now === "number"
        ? normalized.now
        : findLatestTimestamp(rows, normalized.field);
  const threshold = latest - normalized.durationMs;
  let changed = false;
  const retained = rows.filter((row, index) => {
    const time = readTimestamp(row, index, normalized.field);
    const keep = Number.isFinite(time) && time >= threshold;
    if (!keep) changed = true;
    return keep;
  });
  return changed ? Object.freeze(retained) : rows;
}

function findLatestTimestamp<Row>(
  rows: readonly Row[],
  field: RowField<Row> | RowAccessor<Row, Date>,
): number {
  let latest = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < rows.length; index += 1) {
    const timestamp = readTimestamp(rows[index]!, index, field);
    if (timestamp > latest) latest = timestamp;
  }
  return Number.isFinite(latest) ? latest : Date.now();
}

function readTimestamp<Row>(
  row: Readonly<Row>,
  index: number,
  field: RowField<Row> | RowAccessor<Row, Date>,
): number {
  const value =
    typeof field === "function" ? field(row, index) : (row as Record<string, unknown>)[field];
  return value instanceof Date ? value.getTime() : Number.NaN;
}

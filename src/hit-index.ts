import type { HitRegion, HitShape } from "./scene-model";

export interface HitIndex<Row> {
  readonly size: number;
  readonly cellSize: number;
  query(x: number, y: number): HitRegion<Row> | null;
  queryAll(x: number, y: number): readonly HitRegion<Row>[];
  queryRect(x0: number, y0: number, x1: number, y1: number): readonly HitRegion<Row>[];
}

export function createHitIndex<Row>(
  regions: readonly HitRegion<Row>[],
  options: { width: number; height: number; cellSize?: number },
): HitIndex<Row> {
  if (!Number.isFinite(options.width) || options.width <= 0) {
    throw new RangeError("Hit-index width must be a finite positive number.");
  }
  if (!Number.isFinite(options.height) || options.height <= 0) {
    throw new RangeError("Hit-index height must be a finite positive number.");
  }
  if (
    options.cellSize !== undefined &&
    (!Number.isFinite(options.cellSize) || options.cellSize <= 0)
  ) {
    throw new RangeError("Hit-index cellSize must be a finite positive number.");
  }
  const cellSize = Math.max(8, Math.floor(options.cellSize ?? 32));
  const columns = Math.max(1, Math.ceil(options.width / cellSize));
  const rows = Math.max(1, Math.ceil(options.height / cellSize));
  const buckets = new Map<number, number[]>();

  for (let index = 0; index < regions.length; index += 1) {
    const bounds = hitBounds(regions[index]!.shape);
    const startColumn = clampCell(Math.floor(bounds.x0 / cellSize), columns);
    const endColumn = clampCell(Math.floor(bounds.x1 / cellSize), columns);
    const startRow = clampCell(Math.floor(bounds.y0 / cellSize), rows);
    const endRow = clampCell(Math.floor(bounds.y1 / cellSize), rows);
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        const key = row * columns + column;
        const bucket = buckets.get(key) ?? [];
        bucket.push(index);
        buckets.set(key, bucket);
      }
    }
  }

  const queryAll = (x: number, y: number): readonly HitRegion<Row>[] => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return Object.freeze([]);
    const column = clampCell(Math.floor(x / cellSize), columns);
    const row = clampCell(Math.floor(y / cellSize), rows);
    const bucket = buckets.get(row * columns + column);
    if (!bucket) return Object.freeze([]);
    const matches: HitRegion<Row>[] = [];
    for (const index of bucket) {
      const region = regions[index]!;
      if (contains(region.shape, x, y)) matches.push(region);
    }
    matches.sort((left, right) => right.order - left.order);
    return Object.freeze(matches);
  };

  const queryRect = (x0: number, y0: number, x1: number, y1: number) => {
    if (![x0, y0, x1, y1].every(Number.isFinite)) return Object.freeze([]);
    const bounds = {
      x0: Math.min(x0, x1),
      x1: Math.max(x0, x1),
      y0: Math.min(y0, y1),
      y1: Math.max(y0, y1),
    };
    const startColumn = clampCell(Math.floor(bounds.x0 / cellSize), columns);
    const endColumn = clampCell(Math.floor(bounds.x1 / cellSize), columns);
    const startRow = clampCell(Math.floor(bounds.y0 / cellSize), rows);
    const endRow = clampCell(Math.floor(bounds.y1 / cellSize), rows);
    const indices = new Set<number>();
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        for (const index of buckets.get(row * columns + column) ?? []) indices.add(index);
      }
    }
    const matches = [...indices]
      .map((index) => regions[index]!)
      .filter((region) => intersects(hitBounds(region.shape), bounds))
      .sort((left, right) => left.order - right.order);
    return Object.freeze(matches);
  };

  return Object.freeze({
    size: regions.length,
    cellSize,
    query(x: number, y: number) {
      return queryAll(x, y)[0] ?? null;
    },
    queryAll,
    queryRect,
  });
}

function clampCell(value: number, count: number): number {
  return Math.max(0, Math.min(count - 1, value));
}

function hitBounds(shape: HitShape): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  switch (shape.kind) {
    case "rect":
      return {
        x0: shape.x,
        y0: shape.y,
        x1: shape.x + shape.width,
        y1: shape.y + shape.height,
      };
    case "circle":
      return {
        x0: shape.x - shape.radius,
        y0: shape.y - shape.radius,
        x1: shape.x + shape.radius,
        y1: shape.y + shape.radius,
      };
    case "arc":
      return {
        x0: shape.cx - shape.outerRadius,
        y0: shape.cy - shape.outerRadius,
        x1: shape.cx + shape.outerRadius,
        y1: shape.cy + shape.outerRadius,
      };
    case "line": {
      const padding = shape.tolerance;
      return {
        x0: Math.min(shape.x1, shape.x2) - padding,
        y0: Math.min(shape.y1, shape.y2) - padding,
        x1: Math.max(shape.x1, shape.x2) + padding,
        y1: Math.max(shape.y1, shape.y2) + padding,
      };
    }
  }
}

function contains(shape: HitShape, x: number, y: number): boolean {
  switch (shape.kind) {
    case "rect":
      return (
        x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height
      );
    case "circle":
      return (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.radius ** 2;
    case "arc": {
      const dx = x - shape.cx;
      const dy = y - shape.cy;
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius < shape.innerRadius || radius > shape.outerRadius) return false;
      if (Math.abs(shape.endAngle - shape.startAngle) >= Math.PI * 2 - 1e-9) return true;
      const span = shape.endAngle - shape.startAngle;
      const angle = Math.atan2(dy, dx);
      const offset =
        span >= 0
          ? normalizeAngle(angle - shape.startAngle)
          : normalizeAngle(shape.startAngle - angle);
      return offset <= Math.abs(span) + 1e-9;
    }
    case "line":
      return pointSegmentDistance(x, y, shape.x1, shape.y1, shape.x2, shape.y2) <= shape.tolerance;
  }
}

function normalizeAngle(value: number): number {
  const full = Math.PI * 2;
  return ((value % full) + full) % full;
}

function pointSegmentDistance(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function intersects(
  left: { x0: number; y0: number; x1: number; y1: number },
  right: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  return !(left.x1 < right.x0 || left.x0 > right.x1 || left.y1 < right.y0 || left.y0 > right.y1);
}

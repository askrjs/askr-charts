import type { HitRegion, HitShape, SceneMark } from "./scene-model";

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
    matches.sort(
      (left, right) =>
        right.order - left.order ||
        distanceToShape(left.shape, x, y) - distanceToShape(right.shape, x, y),
    );
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
      .filter((region) => shapeIntersectsRect(region.shape, bounds))
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

function shapeIntersectsRect(
  shape: HitShape,
  rect: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  if (!intersects(hitBounds(shape), rect)) return false;
  switch (shape.kind) {
    case "rect":
      return true;
    case "circle": {
      const nearestX = Math.max(rect.x0, Math.min(shape.x, rect.x1));
      const nearestY = Math.max(rect.y0, Math.min(shape.y, rect.y1));
      return (shape.x - nearestX) ** 2 + (shape.y - nearestY) ** 2 <= shape.radius ** 2;
    }
    case "line":
      return (
        contains(shape, rect.x0, rect.y0) ||
        contains(shape, rect.x1, rect.y0) ||
        contains(shape, rect.x0, rect.y1) ||
        contains(shape, rect.x1, rect.y1) ||
        segmentIntersectsRect(shape.x1, shape.y1, shape.x2, shape.y2, rect)
      );
    case "arc": {
      if (
        contains(shape, rect.x0, rect.y0) ||
        contains(shape, rect.x1, rect.y0) ||
        contains(shape, rect.x0, rect.y1) ||
        contains(shape, rect.x1, rect.y1)
      )
        return true;
      const steps = Math.max(
        8,
        Math.ceil(Math.abs(shape.endAngle - shape.startAngle) / (Math.PI / 16)),
      );
      for (const radius of [shape.innerRadius, shape.outerRadius]) {
        for (let index = 0; index <= steps; index += 1) {
          const angle = shape.startAngle + ((shape.endAngle - shape.startAngle) * index) / steps;
          const x = shape.cx + Math.cos(angle) * radius;
          const y = shape.cy + Math.sin(angle) * radius;
          if (x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1) return true;
        }
      }
      return false;
    }
    case "polyline":
      return shape.points.some((point, index) => {
        const next = shape.points[index + 1];
        return next ? segmentIntersectsRect(point.x, point.y, next.x, next.y, rect) : false;
      });
    case "polygon":
      return (
        shape.points.some(
          (point) =>
            point.x >= rect.x0 && point.x <= rect.x1 && point.y >= rect.y0 && point.y <= rect.y1,
        ) ||
        pointInPolygon(shape.points, rect.x0, rect.y0) ||
        shape.points.some((point, index) => {
          const next = shape.points[(index + 1) % shape.points.length];
          return next ? segmentIntersectsRect(point.x, point.y, next.x, next.y, rect) : false;
        })
      );
    case "text":
      return true;
  }
}

function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  if (
    (x1 >= rect.x0 && x1 <= rect.x1 && y1 >= rect.y0 && y1 <= rect.y1) ||
    (x2 >= rect.x0 && x2 <= rect.x1 && y2 >= rect.y0 && y2 <= rect.y1)
  )
    return true;
  const edges = [
    [rect.x0, rect.y0, rect.x1, rect.y0],
    [rect.x1, rect.y0, rect.x1, rect.y1],
    [rect.x1, rect.y1, rect.x0, rect.y1],
    [rect.x0, rect.y1, rect.x0, rect.y0],
  ] as const;
  return edges.some(([ax, ay, bx, by]) => segmentsCross(x1, y1, x2, y2, ax, ay, bx, by));
}

function segmentsCross(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const orient = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (qy - py) * (rx - qx) - (qx - px) * (ry - qy);
  const first = orient(ax, ay, bx, by, cx, cy);
  const second = orient(ax, ay, bx, by, dx, dy);
  const third = orient(cx, cy, dx, dy, ax, ay);
  const fourth = orient(cx, cy, dx, dy, bx, by);
  return first * second <= 0 && third * fourth <= 0;
}

/** Rebuild hit geometry from an interpolated frame while preserving target metadata. */
export function projectHitRegions<Row>(
  regions: readonly HitRegion<Row>[],
  marks: readonly SceneMark<Row>[],
): readonly HitRegion<Row>[] {
  const projected: HitRegion<Row>[] = [];
  for (const region of regions) {
    const mark = marks.find(
      (candidate) =>
        candidate.kind === region.mark &&
        (candidate.id === region.markId ||
          candidate.key === region.key ||
          (candidate.sourceKeys ?? []).includes(region.key)),
    );
    if (!mark) continue;
    const shape = projectedShape(region, mark);
    if (!shape) continue;
    projected.push(Object.freeze({ ...region, markId: mark.id, shape: Object.freeze(shape) }));
  }
  return Object.freeze(projected);
}

export function transformHitRegions<Row>(
  regions: readonly HitRegion<Row>[],
  transform: { scaleX: number; scaleY: number; translateX: number; translateY: number },
): readonly HitRegion<Row>[] {
  return Object.freeze(
    regions.map((region) =>
      Object.freeze({ ...region, shape: Object.freeze(transformShape(region.shape, transform)) }),
    ),
  );
}

function transformShape(
  shape: HitShape,
  transform: { scaleX: number; scaleY: number; translateX: number; translateY: number },
): HitShape {
  const x = (value: number) => value * transform.scaleX + transform.translateX;
  const y = (value: number) => value * transform.scaleY + transform.translateY;
  switch (shape.kind) {
    case "rect": {
      const x0 = x(shape.x);
      const x1 = x(shape.x + shape.width);
      const y0 = y(shape.y);
      const y1 = y(shape.y + shape.height);
      return {
        kind: "rect",
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      };
    }
    case "circle":
      return {
        kind: "circle",
        x: x(shape.x),
        y: y(shape.y),
        radius: shape.radius * Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY)),
      };
    case "line":
      return {
        kind: "line",
        x1: x(shape.x1),
        y1: y(shape.y1),
        x2: x(shape.x2),
        y2: y(shape.y2),
        tolerance:
          shape.tolerance * Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY)),
      };
    case "arc": {
      const radialScale = (Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2;
      return {
        ...shape,
        cx: x(shape.cx),
        cy: y(shape.cy),
        innerRadius: shape.innerRadius * radialScale,
        outerRadius: shape.outerRadius * radialScale,
      };
    }
    case "polyline":
    case "polygon":
      return { ...shape, points: shape.points.map((point) => ({ x: x(point.x), y: y(point.y) })) };
    case "text": {
      const x0 = x(shape.x);
      const x1 = x(shape.x + shape.width);
      const y0 = y(shape.y);
      const y1 = y(shape.y + shape.height);
      return {
        kind: "text",
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      };
    }
  }
}

function projectedShape<Row>(region: HitRegion<Row>, mark: SceneMark<Row>): HitShape | null {
  switch (mark.kind) {
    case "bar":
    case "cell":
    case "rect":
      return { kind: "rect", x: mark.x, y: mark.y, width: mark.width, height: mark.height };
    case "point":
      return { kind: "circle", x: mark.x, y: mark.y, radius: Math.max(5, mark.radius) };
    case "arc":
      return {
        kind: "arc",
        cx: mark.cx,
        cy: mark.cy,
        innerRadius: mark.innerRadius,
        outerRadius: mark.outerRadius,
        startAngle: mark.startAngle,
        endAngle: mark.endAngle,
      };
    case "rule":
      return {
        kind: "line",
        x1: mark.x1,
        y1: mark.y1,
        x2: mark.x2,
        y2: mark.y2,
        tolerance: Math.max(5, mark.strokeWidth / 2),
      };
    case "line": {
      const index = mark.points.findIndex((candidate) => candidate.key === region.key);
      const point = mark.points[index];
      if (!point) return null;
      const previous = mark.points[index - 1];
      const next = mark.points[index + 1];
      return {
        kind: "polyline",
        points: [previous ?? point, point, next ?? point],
        tolerance: 5,
      };
    }
    case "area": {
      const index = mark.points.findIndex((candidate) => candidate.key === region.key);
      const point = mark.points[index];
      const baseline = mark.baseline[index];
      return point && baseline
        ? {
            kind: "polygon",
            points: [
              { x: point.x - 4, y: point.y },
              { x: point.x + 4, y: point.y },
              { x: point.x + 4, y: baseline.y },
              { x: point.x - 4, y: baseline.y },
            ],
          }
        : null;
    }
    case "text": {
      const old = region.shape;
      const width = old.kind === "text" ? old.width : Math.max(8, mark.text.length * 7);
      const height = old.kind === "text" ? old.height : 14;
      return { kind: "text", x: mark.x - width / 2, y: mark.y - height / 2, width, height };
    }
  }
}

function distanceToShape(shape: HitShape, x: number, y: number): number {
  if (contains(shape, x, y)) return 0;
  switch (shape.kind) {
    case "circle":
      return Math.max(0, Math.hypot(x - shape.x, y - shape.y) - shape.radius);
    case "line":
      return pointSegmentDistance(x, y, shape.x1, shape.y1, shape.x2, shape.y2);
    case "arc":
      return Math.abs(
        Math.hypot(x - shape.cx, y - shape.cy) - (shape.innerRadius + shape.outerRadius) / 2,
      );
    case "rect": {
      const dx = Math.max(shape.x - x, 0, x - (shape.x + shape.width));
      const dy = Math.max(shape.y - y, 0, y - (shape.y + shape.height));
      return Math.hypot(dx, dy);
    }
    case "polyline":
      return polylineDistance(shape.points, x, y);
    case "polygon":
      return Math.min(...shape.points.map((point) => Math.hypot(x - point.x, y - point.y)));
    case "text": {
      const dx = Math.max(shape.x - x, 0, x - (shape.x + shape.width));
      const dy = Math.max(shape.y - y, 0, y - (shape.y + shape.height));
      return Math.hypot(dx, dy);
    }
  }
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
    case "polyline":
    case "polygon": {
      const xs = shape.points.map((point) => point.x);
      const ys = shape.points.map((point) => point.y);
      const padding = shape.kind === "polyline" ? shape.tolerance : 0;
      return {
        x0: Math.min(...xs) - padding,
        y0: Math.min(...ys) - padding,
        x1: Math.max(...xs) + padding,
        y1: Math.max(...ys) + padding,
      };
    }
    case "text":
      return {
        x0: shape.x,
        y0: shape.y,
        x1: shape.x + shape.width,
        y1: shape.y + shape.height,
      };
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
    case "polyline":
      return polylineDistance(shape.points, x, y) <= shape.tolerance;
    case "polygon":
      return pointInPolygon(shape.points, x, y);
    case "text":
      return (
        x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height
      );
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

function polylineDistance(
  points: readonly { readonly x: number; readonly y: number }[],
  x: number,
  y: number,
): number {
  if (points.length < 2) return points[0] ? Math.hypot(x - points[0].x, y - points[0].y) : Infinity;
  let distance = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    const first = points[index]!;
    const second = points[index + 1]!;
    distance = Math.min(distance, pointSegmentDistance(x, y, first.x, first.y, second.x, second.y));
  }
  return distance;
}

function pointInPolygon(
  points: readonly { readonly x: number; readonly y: number }[],
  x: number,
  y: number,
): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index]!;
    const previousPoint = points[previous]!;
    if (
      currentPoint.y > y !== previousPoint.y > y &&
      x <
        ((previousPoint.x - currentPoint.x) * (y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function intersects(
  left: { x0: number; y0: number; x1: number; y1: number },
  right: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  return !(left.x1 < right.x0 || left.x0 > right.x1 || left.y1 < right.y0 || left.y0 > right.y1);
}

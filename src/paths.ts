import type { ScenePoint } from "./scene-model";

export function escapeXml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(3)).toString();
}

export function linePath(
  points: readonly Pick<ScenePoint, "x" | "y">[],
  curve: "linear" | "step" | "monotone" = "linear",
): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M${formatNumber(points[0]!.x)},${formatNumber(points[0]!.y)}`;
  }
  if (curve === "step") {
    let path = `M${formatNumber(points[0]!.x)},${formatNumber(points[0]!.y)}`;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]!;
      const point = points[index]!;
      const middle = (previous.x + point.x) / 2;
      path += `H${formatNumber(middle)}V${formatNumber(point.y)}H${formatNumber(point.x)}`;
    }
    return path;
  }
  if (curve === "monotone") return monotonePath(points);
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${formatNumber(point.x)},${formatNumber(point.y)}`,
    )
    .join("");
}

export function segmentedLinePath(
  segments: readonly (readonly Pick<ScenePoint, "x" | "y">[])[],
  curve: "linear" | "step" | "monotone" = "linear",
): string {
  return segments.map((segment) => linePath(segment, curve)).join("");
}

function monotonePath(points: readonly Pick<ScenePoint, "x" | "y">[]): string {
  const slopes = Array.from({ length: points.length - 1 }, () => 0);
  const tangents = Array.from({ length: points.length }, () => 0);
  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index]!;
    const right = points[index + 1]!;
    slopes[index] = right.x === left.x ? 0 : (right.y - left.y) / (right.x - left.x);
  }
  tangents[0] = slopes[0] ?? 0;
  tangents[points.length - 1] = slopes[slopes.length - 1] ?? 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = slopes[index - 1]!;
    const next = slopes[index]!;
    tangents[index] = previous * next <= 0 ? 0 : (previous + next) / 2;
  }
  for (let index = 0; index < slopes.length; index += 1) {
    const slope = slopes[index]!;
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const a = tangents[index]! / slope;
    const b = tangents[index + 1]! / slope;
    const radius = Math.hypot(a, b);
    if (radius > 3) {
      const factor = 3 / radius;
      tangents[index] = factor * a * slope;
      tangents[index + 1] = factor * b * slope;
    }
  }

  let path = `M${formatNumber(points[0]!.x)},${formatNumber(points[0]!.y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index]!;
    const right = points[index + 1]!;
    const dx = (right.x - left.x) / 3;
    path += `C${formatNumber(left.x + dx)},${formatNumber(left.y + dx * tangents[index]!)}`;
    path += ` ${formatNumber(right.x - dx)},${formatNumber(right.y - dx * tangents[index + 1]!)}`;
    path += ` ${formatNumber(right.x)},${formatNumber(right.y)}`;
  }
  return path;
}

export function areaPath(
  points: readonly Pick<ScenePoint, "x" | "y">[],
  baseline: readonly Pick<ScenePoint, "x" | "y">[],
  curve: "linear" | "step" | "monotone" = "linear",
): string {
  if (points.length === 0) return "";
  const top = linePath(points, curve);
  const reversed = [...baseline].reverse();
  const bottom = linePath(reversed, curve).replace(/^M/, "L");
  return `${top}${bottom}Z`;
}

export function arcPath(options: {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  cornerRadius?: number;
}): string {
  const { cx, cy } = options;
  const innerRadius = Math.max(0, options.innerRadius);
  const outerRadius = Math.max(innerRadius, options.outerRadius);
  let startAngle = options.startAngle;
  let endAngle = options.endAngle;
  const full = Math.PI * 2;
  const span = Math.min(full - 1e-6, Math.max(-full + 1e-6, endAngle - startAngle));
  endAngle = startAngle + span;
  const absoluteSpan = Math.abs(span);
  if (outerRadius === 0 || absoluteSpan <= 1e-9) return "";
  const requestedCorner = Math.max(0, finiteValue(options.cornerRadius));
  const thickness = outerRadius - innerRadius;
  const angularLimit =
    innerRadius > 0
      ? Math.min(innerRadius, outerRadius) * absoluteSpan * 0.5
      : outerRadius * absoluteSpan * 0.5;
  const cornerRadius =
    absoluteSpan >= full - 1e-4 ? 0 : Math.min(requestedCorner, thickness * 0.5, angularLimit);

  if (cornerRadius > 1e-6) {
    return roundedArcPath({
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      cornerRadius,
    });
  }

  return sharpArcPath({
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
  });
}

function sharpArcPath(options: {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
}): string {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle } = options;
  const span = endAngle - startAngle;
  const large = Math.abs(span) > Math.PI ? 1 : 0;
  const sweep = span >= 0 ? 1 : 0;
  const outerStart = polar(cx, cy, outerRadius, startAngle);
  const outerEnd = polar(cx, cy, outerRadius, endAngle);

  if (innerRadius === 0) {
    return [
      `M${formatNumber(cx)},${formatNumber(cy)}`,
      `L${formatNumber(outerStart.x)},${formatNumber(outerStart.y)}`,
      `A${formatNumber(outerRadius)},${formatNumber(outerRadius)} 0 ${large} ${sweep} ${formatNumber(outerEnd.x)},${formatNumber(outerEnd.y)}`,
      "Z",
    ].join("");
  }

  const innerEnd = polar(cx, cy, innerRadius, endAngle);
  const innerStart = polar(cx, cy, innerRadius, startAngle);
  return [
    `M${formatNumber(outerStart.x)},${formatNumber(outerStart.y)}`,
    `A${formatNumber(outerRadius)},${formatNumber(outerRadius)} 0 ${large} ${sweep} ${formatNumber(outerEnd.x)},${formatNumber(outerEnd.y)}`,
    `L${formatNumber(innerEnd.x)},${formatNumber(innerEnd.y)}`,
    `A${formatNumber(innerRadius)},${formatNumber(innerRadius)} 0 ${large} ${sweep ? 0 : 1} ${formatNumber(innerStart.x)},${formatNumber(innerStart.y)}`,
    "Z",
  ].join("");
}

function roundedArcPath(options: {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  cornerRadius: number;
}): string {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, cornerRadius } = options;
  const span = endAngle - startAngle;
  const direction = span >= 0 ? 1 : -1;
  const sweep = direction > 0 ? 1 : 0;
  const outerOffset = Math.min(Math.abs(span) / 2, cornerRadius / outerRadius);
  const outerArcStart = polar(cx, cy, outerRadius, startAngle + direction * outerOffset);
  const outerArcEnd = polar(cx, cy, outerRadius, endAngle - direction * outerOffset);
  const outerEdgeStart = polar(cx, cy, outerRadius - cornerRadius, startAngle);
  const outerEdgeEnd = polar(cx, cy, outerRadius - cornerRadius, endAngle);
  const outerCornerStart = polar(cx, cy, outerRadius, startAngle);
  const outerCornerEnd = polar(cx, cy, outerRadius, endAngle);
  const roundedOuterSpan = Math.max(0, Math.abs(span) - outerOffset * 2);

  if (innerRadius === 0) {
    return [
      `M${formatNumber(cx)},${formatNumber(cy)}`,
      `L${formatNumber(outerEdgeStart.x)},${formatNumber(outerEdgeStart.y)}`,
      quadratic(outerCornerStart, outerArcStart),
      circularArc(outerRadius, roundedOuterSpan, sweep, outerArcEnd),
      quadratic(outerCornerEnd, outerEdgeEnd),
      "Z",
    ].join("");
  }

  const innerOffset = Math.min(Math.abs(span) / 2, cornerRadius / innerRadius);
  const innerEdgeEnd = polar(cx, cy, innerRadius + cornerRadius, endAngle);
  const innerArcEnd = polar(cx, cy, innerRadius, endAngle - direction * innerOffset);
  const innerCornerEnd = polar(cx, cy, innerRadius, endAngle);
  const innerArcStart = polar(cx, cy, innerRadius, startAngle + direction * innerOffset);
  const innerCornerStart = polar(cx, cy, innerRadius, startAngle);
  const innerEdgeStart = polar(cx, cy, innerRadius + cornerRadius, startAngle);
  const roundedInnerSpan = Math.max(0, Math.abs(span) - innerOffset * 2);
  return [
    `M${formatNumber(outerEdgeStart.x)},${formatNumber(outerEdgeStart.y)}`,
    quadratic(outerCornerStart, outerArcStart),
    circularArc(outerRadius, roundedOuterSpan, sweep, outerArcEnd),
    quadratic(outerCornerEnd, outerEdgeEnd),
    `L${formatNumber(innerEdgeEnd.x)},${formatNumber(innerEdgeEnd.y)}`,
    quadratic(innerCornerEnd, innerArcEnd),
    circularArc(innerRadius, roundedInnerSpan, sweep ? 0 : 1, innerArcStart),
    quadratic(innerCornerStart, innerEdgeStart),
    "Z",
  ].join("");
}

function quadratic(control: { x: number; y: number }, end: { x: number; y: number }): string {
  return `Q${formatNumber(control.x)},${formatNumber(control.y)} ${formatNumber(end.x)},${formatNumber(end.y)}`;
}

function circularArc(
  radius: number,
  span: number,
  sweep: number,
  end: { x: number; y: number },
): string {
  return `A${formatNumber(radius)},${formatNumber(radius)} 0 ${span > Math.PI ? 1 : 0} ${sweep} ${formatNumber(end.x)},${formatNumber(end.y)}`;
}

function finiteValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

export function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): string {
  const r = Math.max(0, Math.min(Math.abs(width) / 2, Math.abs(height) / 2, radius));
  if (r === 0) {
    return `M${formatNumber(x)},${formatNumber(y)}h${formatNumber(width)}v${formatNumber(height)}h${formatNumber(-width)}Z`;
  }
  return [
    `M${formatNumber(x + r)},${formatNumber(y)}`,
    `H${formatNumber(x + width - r)}`,
    `Q${formatNumber(x + width)},${formatNumber(y)} ${formatNumber(x + width)},${formatNumber(y + r)}`,
    `V${formatNumber(y + height - r)}`,
    `Q${formatNumber(x + width)},${formatNumber(y + height)} ${formatNumber(x + width - r)},${formatNumber(y + height)}`,
    `H${formatNumber(x + r)}`,
    `Q${formatNumber(x)},${formatNumber(y + height)} ${formatNumber(x)},${formatNumber(y + height - r)}`,
    `V${formatNumber(y + r)}`,
    `Q${formatNumber(x)},${formatNumber(y)} ${formatNumber(x + r)},${formatNumber(y)}`,
    "Z",
  ].join("");
}

export function downsamplePixelEnvelope<Point extends { x: number; y: number }>(
  points: readonly Point[],
  pixelWidth: number,
): readonly Point[] {
  const immutablePoints = points.map(
    (point) => Object.freeze({ ...point }) as Readonly<Point> as Point,
  );
  if (immutablePoints.length <= Math.max(4, pixelWidth * 2) || pixelWidth <= 0)
    return Object.freeze(immutablePoints);
  const buckets = new Map<
    number,
    {
      first: { point: Point; index: number };
      last: { point: Point; index: number };
      min: { point: Point; index: number };
      max: { point: Point; index: number };
    }
  >();
  for (let index = 0; index < immutablePoints.length; index += 1) {
    const point = immutablePoints[index]!;
    const entry = { point, index };
    const bucket = Math.floor(point.x);
    const current = buckets.get(bucket);
    if (!current) {
      buckets.set(bucket, {
        first: entry,
        last: entry,
        min: entry,
        max: entry,
      });
    } else {
      current.last = entry;
      if (point.y < current.min.point.y) current.min = entry;
      if (point.y > current.max.point.y) current.max = entry;
    }
  }
  const result: Point[] = [];
  for (const bucket of buckets.values()) {
    const candidates = [bucket.first, bucket.min, bucket.max, bucket.last].sort(
      (left, right) => left.index - right.index,
    );
    for (const { point } of candidates) {
      if (result[result.length - 1] !== point) result.push(point);
    }
  }
  return Object.freeze(result);
}

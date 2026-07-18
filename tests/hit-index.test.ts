import { describe, expect, it } from "vite-plus/test";

import { createHitIndex, projectHitRegions, transformHitRegions } from "../src/hit-index";
import type { HitRegion, HitShape, SceneMark } from "../src/scene-model";

interface Row {
  readonly id: string;
}

function region(id: string, shape: HitShape, order = 0): HitRegion<Row> {
  return Object.freeze({
    id,
    shape,
    row: Object.freeze({ id }),
    sourceIndex: order,
    key: id,
    mark: shape.kind === "line" ? "line" : ("point" as SceneMark<Row>["kind"]),
    title: id,
    channels: Object.freeze({}),
    series: null,
    order,
  });
}

describe("spatial hit index", () => {
  it("should match rectangle circle arc and line geometry given points when querying", () => {
    const rectangles = region("rect", {
      kind: "rect",
      x: 10,
      y: 10,
      width: 20,
      height: 10,
    });
    const circles = region("circle", {
      kind: "circle",
      x: 50,
      y: 20,
      radius: 5,
    });
    const arcs = region("arc", {
      kind: "arc",
      cx: 30,
      cy: 60,
      innerRadius: 5,
      outerRadius: 15,
      startAngle: 0,
      endAngle: Math.PI / 2,
    });
    const lines = region("line", {
      kind: "line",
      x1: 70,
      y1: 10,
      x2: 90,
      y2: 10,
      tolerance: 2,
    });
    const index = createHitIndex([rectangles, circles, arcs, lines], {
      width: 100,
      height: 100,
      cellSize: 16,
    });

    expect(index.query(15, 15)?.id).toBe("rect");
    expect(index.query(54, 20)?.id).toBe("circle");
    expect(index.query(40, 65)?.id).toBe("arc");
    expect(index.query(80, 11.5)?.id).toBe("line");
    expect(index.query(30, 60)).toBeNull();
    expect(index.query(80, 13)).toBeNull();
  });

  it("should match polyline polygon and measured text geometry given exact shapes", () => {
    const polyline = region("polyline", {
      kind: "polyline",
      points: [
        { x: 5, y: 5 },
        { x: 20, y: 15 },
        { x: 35, y: 5 },
      ],
      tolerance: 2,
    });
    const polygon = region("polygon", {
      kind: "polygon",
      points: [
        { x: 45, y: 5 },
        { x: 65, y: 5 },
        { x: 55, y: 25 },
      ],
    });
    const text = region("text", { kind: "text", x: 70, y: 8, width: 20, height: 12 });
    const index = createHitIndex([polyline, polygon, text], { width: 100, height: 40 });

    expect(index.query(20, 15)?.id).toBe("polyline");
    expect(index.query(55, 12)?.id).toBe("polygon");
    expect(index.query(80, 14)?.id).toBe("text");
    expect(index.query(55, 28)).toBeNull();
  });

  it("should honor wrapped and complete angular spans given ring sectors when querying arcs", () => {
    const wrapped = region("wrapped", {
      kind: "arc",
      cx: 25,
      cy: 25,
      innerRadius: 5,
      outerRadius: 15,
      startAngle: (Math.PI * 3) / 2,
      endAngle: (Math.PI * 5) / 2,
    });
    const complete = region("complete", {
      kind: "arc",
      cx: 75,
      cy: 25,
      innerRadius: 5,
      outerRadius: 15,
      startAngle: 0,
      endAngle: Math.PI * 2,
    });
    const index = createHitIndex([wrapped, complete], {
      width: 100,
      height: 50,
    });

    expect(index.query(35, 25)?.id).toBe("wrapped");
    expect(index.query(15, 25)).toBeNull();
    expect(index.query(75, 35)?.id).toBe("complete");
  });

  it("should follow the signed angular direction given a reverse ring sector", () => {
    const reverse = region("reverse", {
      kind: "arc",
      cx: 25,
      cy: 25,
      innerRadius: 5,
      outerRadius: 15,
      startAngle: (Math.PI * 3) / 2,
      endAngle: Math.PI / 2,
    });
    const index = createHitIndex([reverse], { width: 50, height: 50 });

    expect(index.query(15, 25)?.id).toBe("reverse");
    expect(index.query(35, 25)).toBeNull();
  });

  it("should return topmost-first matches given overlapping regions when querying a point", () => {
    const bottom = region("bottom", { kind: "rect", x: 10, y: 10, width: 20, height: 20 }, 1);
    const top = region("top", { kind: "circle", x: 20, y: 20, radius: 10 }, 9);
    const middle = region("middle", { kind: "rect", x: 15, y: 15, width: 10, height: 10 }, 4);
    const index = createHitIndex([top, bottom, middle], {
      width: 50,
      height: 50,
    });

    expect(index.query(20, 20)?.id).toBe("top");
    expect(index.queryAll(20, 20).map(({ id }) => id)).toEqual(["top", "middle", "bottom"]);
    expect(Object.isFrozen(index.queryAll(20, 20))).toBe(true);
  });

  it("should deduplicate and return scene order given reversed bounds when querying a rectangle", () => {
    const first = region("first", { kind: "rect", x: 5, y: 5, width: 30, height: 30 }, 1);
    const second = region("second", { kind: "circle", x: 40, y: 40, radius: 8 }, 2);
    const outside = region("outside", { kind: "rect", x: 80, y: 80, width: 5, height: 5 }, 3);
    const index = createHitIndex([outside, second, first], {
      width: 100,
      height: 100,
      cellSize: 8,
    });

    const result = index.queryRect(50, 50, 10, 10);

    expect(result.map(({ id }) => id)).toEqual(["first", "second"]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("should reject a bounds-only circle overlap given an exact rectangular brush", () => {
    const circle = region("circle", { kind: "circle", x: 10, y: 10, radius: 8 });
    const index = createHitIndex([circle], { width: 40, height: 40 });

    expect(index.queryRect(16, 16, 20, 20)).toEqual([]);
    expect(index.queryRect(14, 14, 20, 20).map(({ id }) => id)).toEqual(["circle"]);
  });

  it("should align hit geometry to the interpolated presented frame", () => {
    const hit = region("point-hit", { kind: "circle", x: 90, y: 20, radius: 5 });
    const mark: SceneMark<Row> = {
      id: "point-0-point-hit-0",
      key: "point-hit",
      sourceIndex: 0,
      row: { id: "point-hit" },
      kind: "point",
      fill: "#2563eb",
      stroke: "none",
      opacity: 1,
      title: "point-hit",
      series: null,
      channels: {},
      x: 45,
      y: 20,
      radius: 4,
      shape: "circle",
    };

    const projected = projectHitRegions([hit], [mark]);
    const index = createHitIndex(projected, { width: 100, height: 50 });

    expect(index.query(45, 20)?.key).toBe("point-hit");
    expect(index.query(90, 20)).toBeNull();
  });

  it("should apply the gesture transform identically to hit geometry", () => {
    const hit = region("point", { kind: "circle", x: 20, y: 30, radius: 4 });
    const transformed = transformHitRegions([hit], {
      scaleX: 2,
      scaleY: 0.5,
      translateX: 10,
      translateY: 5,
    });
    const index = createHitIndex(transformed, { width: 100, height: 100 });

    expect(index.query(50, 20)?.key).toBe("point");
    expect(index.query(20, 30)).toBeNull();
  });

  it("should return empty matches given non-finite coordinates when querying a point", () => {
    const index = createHitIndex([region("only", { kind: "circle", x: 10, y: 10, radius: 2 })], {
      width: 20,
      height: 20,
    });

    expect(index.query(Number.NaN, 10)).toBeNull();
    expect(index.queryAll(10, Number.POSITIVE_INFINITY)).toEqual([]);
    expect(index.queryRect(0, 0, Number.NaN, 10)).toEqual([]);
  });

  it("should reject invalid dimensions given a malformed index configuration", () => {
    expect(() => createHitIndex([], { width: Number.NaN, height: 20 })).toThrow(RangeError);
    expect(() => createHitIndex([], { width: 20, height: 0 })).toThrow(RangeError);
    expect(() =>
      createHitIndex([], { width: 20, height: 20, cellSize: Number.POSITIVE_INFINITY }),
    ).toThrow(RangeError);
  });

  it("should keep localized queries bounded given one hundred thousand regions when inspecting points", () => {
    const regions = Array.from({ length: 100_000 }, (_, value) =>
      region(
        String(value),
        {
          kind: "circle",
          x: value % 1_000,
          y: Math.floor(value / 1_000),
          radius: 0.2,
        },
        value,
      ),
    );
    const index = createHitIndex(regions, {
      width: 1_000,
      height: 100,
      cellSize: 16,
    });
    const started = performance.now();

    for (let iteration = 0; iteration < 2_000; iteration += 1) {
      const value = (iteration * 7_919) % regions.length;
      expect(index.query(value % 1_000, Math.floor(value / 1_000))?.id).toBe(String(value));
    }

    expect(index.size).toBe(100_000);
    expect(performance.now() - started).toBeLessThan(750);
  });
});

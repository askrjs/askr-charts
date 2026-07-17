const noop = () => undefined;

export function installPath2DStub(): void {
  if (typeof globalThis.Path2D !== "undefined") return;
  class BenchmarkPath2D {
    constructor(_path?: string | Path2D) {}
  }
  Object.defineProperty(globalThis, "Path2D", {
    configurable: true,
    value: BenchmarkPath2D,
  });
}

export function createNoopCanvasContext(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {
    arc: noop,
    beginPath: noop,
    clearRect: noop,
    clip: noop,
    closePath: noop,
    fill: noop,
    fillRect: noop,
    fillText: noop,
    lineTo: noop,
    moveTo: noop,
    rect: noop,
    restore: noop,
    save: noop,
    setLineDash: noop,
    setTransform: noop,
    stroke: noop,
    strokeRect: noop,
  };
  return new Proxy(target, {
    set(object, property, value) {
      object[String(property)] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

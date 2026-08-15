import { cleanupApp, createIsland } from "@askrjs/askr/boot";
import type { JSXElement } from "@askrjs/askr/jsx-runtime";
import { Dialog, DialogClose, DialogContent, DialogPortal, DialogTitle } from "@askrjs/ui/dialog";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createPlot } from "../../src";

const Plot = createPlot<{ id: string; x: number; y: number }>();
const rows = Object.freeze([
  { id: "a", x: 1, y: 2 },
  { id: "b", x: 2, y: 4 },
]);
let container: HTMLDivElement | undefined;

afterEach(() => {
  if (container) {
    cleanupApp(container);
    container.remove();
    container = undefined;
  }
});

describe("nested container teardown", () => {
  it("should destroy a chart cleanly when its Dialog portal closes", async () => {
    container = mount(<ChartDialog />);
    await flushPaint();
    const content = document.querySelector('[data-slot="dialog-content"]');
    const chart = content?.querySelector('[data-slot="plot-root"]');
    const close = content?.querySelector<HTMLButtonElement>('[data-testid="close-chart-dialog"]');
    const canvases = [...(chart?.querySelectorAll("canvas") ?? [])];

    expect(chart).not.toBeNull();
    expect(close).not.toBeNull();
    close!.click();
    await flushPaint();

    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(chart?.isConnected).toBe(false);
    expect(canvases.every(({ width, height }) => width === 0 && height === 0)).toBe(true);
  });

  it("should tolerate root cleanup racing a Dialog portal close", async () => {
    container = mount(<ChartDialog />);
    await flushPaint();
    const close = document.querySelector<HTMLButtonElement>('[data-testid="close-chart-dialog"]');
    const canvases = [
      ...document.querySelectorAll<HTMLCanvasElement>('[data-slot^="plot-canvas-"]'),
    ];

    expect(close).not.toBeNull();
    close!.click();
    expect(() => cleanupApp(container!)).not.toThrow();
    container.remove();
    container = undefined;
    await flushPaint();

    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(canvases.every(({ width, height }) => width === 0 && height === 0)).toBe(true);
  });
});

function ChartDialog() {
  return (
    <Dialog defaultOpen>
      <DialogPortal>
        <DialogContent>
          <DialogTitle>Chart details</DialogTitle>
          <Plot.Root data={rows} rowKey="id" label="Dialog chart" width={320} height={180}>
            <Plot.Line x="x" y="y" />
          </Plot.Root>
          <DialogClose data-testid="close-chart-dialog">Close</DialogClose>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function mount(element: JSXElement): HTMLDivElement {
  const root = document.createElement("div");
  document.body.append(root);
  createIsland({ root, component: () => element });
  return root;
}

async function flushPaint(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

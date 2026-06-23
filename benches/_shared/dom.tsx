import { cleanupApp, createIsland } from "@askrjs/askr/boot";

export function mountBench(element: JSX.Element): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  createIsland({
    root: container,
    component: () => element,
  });
  return container;
}

export function unmountBench(container: HTMLElement | undefined): void {
  if (container) {
    cleanupApp(container);
  }

  if (container?.parentNode) {
    container.parentNode.removeChild(container);
  }
}

export async function flushBenchUpdates(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export async function runMountedBench(
  element: JSX.Element,
  callback: (container: HTMLElement) => void | Promise<void>,
): Promise<void> {
  const container = mountBench(element);

  try {
    await flushBenchUpdates();
    await callback(container);
  } finally {
    unmountBench(container);
  }
}

export function normalizeStyle(style: string | null | undefined): string {
  return (style ?? "").replace(/\s*:\s*/g, ":").replace(/;\s*/g, ";");
}

export function expectBenchElement<T extends Element>(
  container: ParentNode,
  selector: string,
  label: string,
): T {
  const element = container.querySelector<T>(selector);

  if (!element) {
    throw new Error(`${label} bench failed to mount ${selector}`);
  }

  return element;
}

export function expectBenchCount(container: ParentNode, selector: string, count: number): NodeList {
  const elements = container.querySelectorAll(selector);

  if (elements.length !== count) {
    throw new Error(
      `bench expected ${count} elements for ${selector}, mounted ${elements.length}`,
    );
  }

  return elements;
}

export function dispatchPointerMove(
  target: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
  point: { clientX: number; clientY: number },
): void {
  Object.defineProperty(target, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: rect.top + rect.height,
      height: rect.height,
      left: rect.left,
      right: rect.left + rect.width,
      top: rect.top,
      width: rect.width,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }),
  });

  const event = new Event("pointermove", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: point.clientX });
  Object.defineProperty(event, "clientY", { value: point.clientY });
  target.dispatchEvent(event);
}

import { cleanupApp, createIsland } from "@askrjs/askr/boot";
import type { JSXElement } from "@askrjs/askr/jsx-runtime";

export function mountPlot(element: JSXElement, width = 800): HTMLDivElement {
  const root = document.createElement("div");
  root.style.width = `${width}px`;
  document.body.append(root);
  createIsland({ root, component: () => element });
  return root;
}

export function unmountPlot(root: HTMLDivElement | undefined): void {
  if (!root) return;
  cleanupApp(root);
  root.remove();
}

export async function flushCanvasPaint(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

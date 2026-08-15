import { afterEach, describe, expect, it } from "vite-plus/test";
import "../../src/styles.css";

const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
});

describe("chart accessibility defaults", () => {
  it("should keep every data-series color distinguishable from every chart background", () => {
    for (const theme of ["light", "dark"] as const) {
      const host = document.createElement("div");
      host.dataset.theme = theme;
      const probe = document.createElement("span");
      host.append(probe);
      document.body.append(host);
      mounted.push(host);

      for (const backgroundToken of ["--ak-chart-bg", "--ak-chart-surface"]) {
        const background = resolvedColor(probe, backgroundToken);
        for (let index = 1; index <= 10; index += 1) {
          const seriesToken = `--ak-chart-series-${index}`;
          const ratio = contrast(resolvedColor(probe, seriesToken), background);
          expect(
            ratio,
            `${theme} ${seriesToken} against ${backgroundToken} has ${ratio.toFixed(2)}:1 contrast`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});

function resolvedColor(element: HTMLElement, token: string): readonly [number, number, number] {
  element.style.color = `var(${token})`;
  const channels = getComputedStyle(element).color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Unable to resolve ${token}`);
  return channels as unknown as readonly [number, number, number];
}

function contrast(
  foreground: readonly [number, number, number],
  background: readonly [number, number, number],
): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(color: readonly [number, number, number]): number {
  const [red, green, blue] = color.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}

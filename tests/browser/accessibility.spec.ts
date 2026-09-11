import { expect, test } from "./fixtures";

type Channels = readonly [number, number, number];
type ColorMatrix = readonly [Channels, Channels, Channels];

const PROTANOPIA: ColorMatrix = [
  [0.152286, 1.052583, -0.204868],
  [0.114503, 0.786281, 0.099216],
  [-0.003882, -0.048116, 1.051998],
];
const DEUTERANOPIA: ColorMatrix = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
];

const BACKGROUND_TOKENS = ["--ak-chart-bg", "--ak-chart-surface"] as const;
const THEMES = ["light", "dark"] as const;

/**
 * Resolves `var(<token>)` values against a probe element inside a themed host,
 * mirroring the `resolvedColor` helper of the old vitest browser test.
 */
async function resolveTokens(
  page: import("@playwright/test").Page,
  theme: string | undefined,
  tokens: readonly string[],
): Promise<Channels[]> {
  return (await page.evaluate(
    ({ theme, tokens }) => {
      const host = document.createElement("div");
      if (theme) host.dataset.theme = theme;
      const probe = document.createElement("span");
      host.append(probe);
      document.body.append(host);

      return tokens.map((token) => {
        probe.style.color = `var(${token})`;
        const channels = getComputedStyle(probe)
          .color.match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number);
        if (!channels || channels.length !== 3) throw new Error(`Unable to resolve ${token}`);
        return channels as [number, number, number];
      });
    },
    { theme, tokens },
  )) as Channels[];
}

test.describe("chart accessibility defaults", () => {
  test("should keep every data-series color distinguishable from every chart background", async ({
    page,
  }) => {
    const seriesTokens = Array.from({ length: 10 }, (_, index) => `--ak-chart-series-${index + 1}`);

    for (const theme of THEMES) {
      const resolved = await resolveTokens(page, theme, [...BACKGROUND_TOKENS, ...seriesTokens]);
      const series = resolved.slice(BACKGROUND_TOKENS.length);

      for (const [backgroundIndex, backgroundToken] of BACKGROUND_TOKENS.entries()) {
        const background = resolved[backgroundIndex]!;
        for (const [index, seriesColor] of series.entries()) {
          const seriesToken = seriesTokens[index]!;
          const ratio = contrast(seriesColor, background);
          expect(
            ratio,
            `${theme} ${seriesToken} against ${backgroundToken} has ${ratio.toFixed(2)}:1 contrast`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  test("should keep every default series pair distinguishable under red-green color blindness", async ({
    page,
  }) => {
    const palette = await resolveTokens(
      page,
      undefined,
      Array.from({ length: 10 }, (_, index) => `--ak-chart-series-${index + 1}`),
    );

    for (const simulation of [PROTANOPIA, DEUTERANOPIA] as const) {
      for (let first = 0; first < palette.length; first += 1) {
        for (let second = first + 1; second < palette.length; second += 1) {
          const distance = colorDistance(
            simulateColorBlindness(palette[first]!, simulation),
            simulateColorBlindness(palette[second]!, simulation),
          );
          expect(
            distance,
            `series ${first + 1} and ${second + 1} have simulated distance ${distance.toFixed(1)}`,
          ).toBeGreaterThanOrEqual(55);
        }
      }
    }
  });
});

function simulateColorBlindness(color: Channels, matrix: ColorMatrix): Channels {
  return matrix.map((row) =>
    row.reduce((total, coefficient, index) => total + coefficient * color[index]!, 0),
  ) as unknown as Channels;
}

function colorDistance(first: Channels, second: Channels): number {
  return Math.hypot(...first.map((channel, index) => channel - second[index]!));
}

function contrast(foreground: Channels, background: Channels): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(color: Channels): number {
  const [red, green, blue] = color.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}

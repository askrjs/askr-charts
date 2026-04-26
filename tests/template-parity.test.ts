import { describe, expect, it } from "vite-plus/test";
import { existsSync, readFileSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";

const DEFAULT_CHART_DIR = join(__dirname, "..", "src", "charts", "default");
const CHART_STYLES_DIR = join(DEFAULT_CHART_DIR, "styles");
const CHARTS_DIR = join(__dirname, "..", "src", "charts");
const TEMPLATE_CHART_DIR = join(__dirname, "..", "templates", "chart");
const TEMPLATE_STYLES_DIR = join(TEMPLATE_CHART_DIR, "styles");
const DEFAULT_TOKENS = join(DEFAULT_CHART_DIR, "tokens.css");
const TEMPLATE_TOKENS = join(TEMPLATE_CHART_DIR, "tokens.css");

function listCssFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  function collect(currentDir: string, relativeDir = ""): string[] {
    return readdirSync(currentDir, { withFileTypes: true }).flatMap((entry: Dirent) => {
      const entryPath = join(currentDir, entry.name);
      const relativePath = relativeDir ? join(relativeDir, entry.name) : entry.name;

      if (entry.isDirectory()) {
        return collect(entryPath, relativePath);
      }

      return entry.name.endsWith(".css") ? [relativePath] : [];
    });
  }

  return collect(dir).sort();
}

function extractTokenNames(css: string): string[] {
  return [...css.matchAll(/(--ak-chart-[a-z0-9-]+)\b/g)]
    .map((match) => match[1])
    .filter((token, index, all) => all.indexOf(token) === index)
    .sort();
}

describe("template parity", () => {
  const defaultFiles = listCssFiles(CHART_STYLES_DIR);
  const templateFiles = listCssFiles(TEMPLATE_STYLES_DIR);

  it("should find default chart style files", () => {
    expect(defaultFiles.length).toBeGreaterThan(0);
  });

  it("should find template chart style files", () => {
    expect(templateFiles.length).toBeGreaterThan(0);
  });

  it("template covers every style file in the default chart package", () => {
    const missingInTemplate = defaultFiles.filter((file) => !templateFiles.includes(file));
    expect(
      missingInTemplate,
      `Default chart package has style files missing from template: ${missingInTemplate.join(", ")}`,
    ).toEqual([]);
  });

  it("template has no extra style files not in the default chart package", () => {
    const extraInTemplate = templateFiles.filter((file) => !defaultFiles.includes(file));
    expect(
      extraInTemplate,
      `Template has extra style files not in the default chart package: ${extraInTemplate.join(", ")}`,
    ).toEqual([]);
  });

  it("template tokens expose the same canonical token names as the default chart package", () => {
    const defaultTokens = extractTokenNames(readFileSync(DEFAULT_TOKENS, "utf-8"));
    const templateTokens = extractTokenNames(readFileSync(TEMPLATE_TOKENS, "utf-8"));

    expect(templateTokens).toEqual(defaultTokens);
  });

  it("official chart entrypoints use the same canonical layout imports", () => {
    const chartNames = readdirSync(CHARTS_DIR).filter((entry) =>
      existsSync(join(CHARTS_DIR, entry, "index.css")),
    );

    const importsByChart = new Map<string, string[]>();
    for (const chart of chartNames) {
      const css = readFileSync(join(CHARTS_DIR, chart, "index.css"), "utf-8");
      const imports = css
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("@import "));
      importsByChart.set(chart, imports);
    }

    const defaultImports = importsByChart.get("default") ?? [];
    for (const [chart, imports] of importsByChart) {
      expect(imports, `${chart} chart imports drift from default`).toEqual(defaultImports);
    }
  });

  it("official chart token files keep the same canonical token names as default", () => {
    const chartNames = readdirSync(CHARTS_DIR).filter((entry) =>
      existsSync(join(CHARTS_DIR, entry, "tokens.css")),
    );
    const defaultTokens = extractTokenNames(readFileSync(DEFAULT_TOKENS, "utf-8"));

    for (const chart of chartNames) {
      const chartTokens = extractTokenNames(
        readFileSync(join(CHARTS_DIR, chart, "tokens.css"), "utf-8"),
      );

      expect(chartTokens, `${chart} chart token definitions drift from default`).toEqual(
        defaultTokens,
      );
    }
  });

  it("official chart style directories keep the same canonical files as default", () => {
    const chartNames = readdirSync(CHARTS_DIR).filter((entry) =>
      existsSync(join(CHARTS_DIR, entry, "styles")),
    );

    for (const chart of chartNames) {
      const chartFiles = listCssFiles(join(CHARTS_DIR, chart, "styles"));
      expect(chartFiles, `${chart} chart style files drift from default`).toEqual(defaultFiles);
    }
  });
});

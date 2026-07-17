import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vite-plus/test";

const workspace = resolve(import.meta.dirname, "..");
const examples = [
  "examples/mixed-histogram-trend.tsx",
  "examples/mark-families.tsx",
  "examples/live-interactions-export.tsx",
].map((file) => resolve(workspace, file));

describe("local plot examples", () => {
  it("should typecheck every official composition given the source package when compiling examples", () => {
    const configPath = resolve(workspace, "tsconfig.json");
    const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
    expect(loaded.error).toBeUndefined();
    const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, workspace);
    const program = ts.createProgram({
      rootNames: examples,
      options: {
        ...parsed.options,
        noEmit: true,
        paths: {
          ...parsed.options.paths,
          "@askrjs/charts": ["src/index.ts"],
        },
      },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(formatDiagnostics(diagnostics)).toBe("");
  });
});

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  if (diagnostics.length === 0) return "";
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => workspace,
    getNewLine: () => "\n",
  });
}

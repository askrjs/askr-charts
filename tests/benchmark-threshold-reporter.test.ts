import type { Reporter } from "vitest/reporters";
import { describe, expect, it } from "vite-plus/test";
import { BenchmarkThresholdReporter } from "../benches/_shared/threshold-reporter";

type ReportedTestCase = Parameters<NonNullable<Reporter["onTestCaseResult"]>>[0];

function benchmarkCase(name: string, p99: number): ReportedTestCase {
  return {
    name,
    meta: () => ({ benchmark: true }),
    task: {
      result: {
        benchmark: { p99 },
      },
    },
  } as unknown as ReportedTestCase;
}

describe("benchmark threshold reporter", () => {
  it("should leave the exit status unchanged given a measured p99 within budget when finishing", () => {
    let failed = false;
    let output = "";
    const reporter = new BenchmarkThresholdReporter([{ name: "hot path", p99Milliseconds: 16.7 }], {
      fail: () => {
        failed = true;
      },
      write: (message) => {
        output += message;
      },
    });

    reporter.onTestRunStart();
    reporter.onTestCaseResult(benchmarkCase("hot path", 16.7));
    reporter.onTestRunEnd();

    expect(failed).toBe(false);
    expect(output).toBe("");
  });

  it("should request a nonzero exit given a deliberately impossible p99 budget when finishing", () => {
    let failed = false;
    let output = "";
    const reporter = new BenchmarkThresholdReporter([{ name: "hot path", p99Milliseconds: 0 }], {
      fail: () => {
        failed = true;
      },
      write: (message) => {
        output += message;
      },
    });

    reporter.onTestRunStart();
    reporter.onTestCaseResult(benchmarkCase("hot path", 0.001));
    reporter.onTestRunEnd();

    expect(failed).toBe(true);
    expect(output).toContain("p99 0.001ms exceeds 0.000ms");
  });

  it("should request a nonzero exit given a missing acceptance row when finishing", () => {
    let failed = false;
    let output = "";
    const reporter = new BenchmarkThresholdReporter(
      [{ name: "renamed hot path", p99Milliseconds: 2 }],
      {
        fail: () => {
          failed = true;
        },
        write: (message) => {
          output += message;
        },
      },
    );

    reporter.onTestRunStart();
    reporter.onTestCaseResult(benchmarkCase("hot path", 0.001));
    reporter.onTestRunEnd();

    expect(failed).toBe(true);
    expect(output).toContain("renamed hot path: result missing");
  });
});

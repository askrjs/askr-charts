import type { BenchmarkResult } from "vitest";
import type { Reporter } from "vitest/reporters";

type ReportedTestCase = Parameters<NonNullable<Reporter["onTestCaseResult"]>>[0];

export interface BenchmarkThreshold {
  readonly name: string;
  readonly p99Milliseconds: number;
}

interface BenchmarkTaskResult {
  readonly result?: {
    readonly benchmark?: Pick<BenchmarkResult, "p99">;
  };
}

interface ThresholdReporterRuntime {
  readonly fail: () => void;
  readonly write: (message: string) => void;
}

const defaultRuntime: ThresholdReporterRuntime = {
  fail: () => {
    process.exitCode = 1;
  },
  write: (message) => {
    process.stderr.write(message);
  },
};

/**
 * Fails a benchmark command when an acceptance row breaches its p99 budget.
 *
 * Rules use exact benchmark names on purpose: renaming or removing an acceptance
 * row is a failure instead of silently disabling its performance contract.
 */
export class BenchmarkThresholdReporter implements Reporter {
  readonly #thresholds: ReadonlyMap<string, number>;
  readonly #runtime: ThresholdReporterRuntime;
  readonly #observations = new Map<string, number>();
  readonly #duplicates = new Set<string>();

  constructor(
    thresholds: readonly BenchmarkThreshold[],
    runtime: ThresholdReporterRuntime = defaultRuntime,
  ) {
    const names = new Set<string>();
    for (const threshold of thresholds) {
      if (names.has(threshold.name)) {
        throw new Error(`Duplicate benchmark threshold: ${threshold.name}`);
      }
      if (!Number.isFinite(threshold.p99Milliseconds) || threshold.p99Milliseconds < 0) {
        throw new Error(`Invalid p99 benchmark threshold for ${threshold.name}`);
      }
      names.add(threshold.name);
    }

    this.#thresholds = new Map(
      thresholds.map((threshold) => [threshold.name, threshold.p99Milliseconds]),
    );
    this.#runtime = runtime;
  }

  onTestRunStart(): void {
    this.#observations.clear();
    this.#duplicates.clear();
  }

  onTestCaseResult(testCase: ReportedTestCase): void {
    if (!this.#thresholds.has(testCase.name) || !testCase.meta().benchmark) return;

    const task = testCase as ReportedTestCase & { readonly task: BenchmarkTaskResult };
    const p99 = task.task.result?.benchmark?.p99;
    if (p99 === undefined) return;

    if (this.#observations.has(testCase.name)) this.#duplicates.add(testCase.name);
    this.#observations.set(testCase.name, p99);
  }

  onTestRunEnd(): void {
    const failures: string[] = [];

    for (const [name, limit] of this.#thresholds) {
      if (this.#duplicates.has(name)) {
        failures.push(`${name}: reported more than once`);
        continue;
      }

      const p99 = this.#observations.get(name);
      if (p99 === undefined) {
        failures.push(`${name}: result missing (p99 limit ${formatMilliseconds(limit)})`);
      } else if (p99 > limit) {
        failures.push(
          `${name}: p99 ${formatMilliseconds(p99)} exceeds ${formatMilliseconds(limit)}`,
        );
      }
    }

    if (failures.length === 0) return;

    this.#runtime.write(
      `\nBenchmark acceptance failed:\n${failures.map((failure) => `  - ${failure}`).join("\n")}\n`,
    );
    this.#runtime.fail();
  }
}

export function benchmarkThresholdReporter(
  thresholds: readonly BenchmarkThreshold[],
): BenchmarkThresholdReporter {
  return new BenchmarkThresholdReporter(thresholds);
}

function formatMilliseconds(value: number): string {
  return `${value.toFixed(value < 10 ? 3 : 1)}ms`;
}

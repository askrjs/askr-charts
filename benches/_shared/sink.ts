let benchmarkSink: unknown;

export function consume(value: unknown): void {
  benchmarkSink = value;
}

export function consumedValue(): unknown {
  return benchmarkSink;
}

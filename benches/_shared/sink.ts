let benchSink: unknown;

export function consume(value: unknown): void {
  benchSink = value;
}

export function readConsumedValue(): unknown {
  return benchSink;
}

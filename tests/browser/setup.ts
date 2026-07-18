import { afterEach, beforeEach } from "vite-plus/test";

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

runtime.process = {
  ...runtime.process,
  env: { ...runtime.process?.env, NODE_ENV: "production" },
};

const unexpected: string[] = [];
const warn = console.warn.bind(console);
const error = console.error.bind(console);

beforeEach(() => {
  unexpected.length = 0;
});

console.warn = (...values: unknown[]) => {
  warn(...values);
  unexpected.push(`warning: ${values.map(String).join(" ")}`);
};

console.error = (...values: unknown[]) => {
  error(...values);
  unexpected.push(`error: ${values.map(String).join(" ")}`);
};

afterEach(() => {
  if (unexpected.length > 0) throw new Error(`Unexpected browser console output:\n${unexpected.join("\n")}`);
});

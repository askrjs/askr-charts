// Temporary local type shim for sibling `file:` dependencies.
// Remove this once `../askr` and `../askr-ui` reliably emit the dist .d.ts
// files referenced by this package's tsconfig path mappings.

declare module "@askrjs/askr/foundations" {
  export type Props = Record<string, unknown> & {
    children?: unknown;
    ref?: unknown;
  };

  export interface JSXElement {
    $$typeof: symbol;
    type: string | ((props: Props) => unknown) | symbol;
    props: Props;
    key?: string | number | null;
  }

  export interface SlotProps extends Props {
    asChild?: boolean;
  }

  export function Slot(props: SlotProps): JSXElement;

  export interface PresenceProps extends Props {
    present?: boolean;
  }

  export function Presence(props: PresenceProps): JSXElement | null;
}

declare module "@askrjs/askr" {
  import type { JSXElement } from "@askrjs/askr/foundations";

  export interface State<T> {
    (): T;
    set(value: T): void;
    set(updater: (prev: T) => T): void;
    [Symbol.iterator](): Iterator<State<T> | State<T>["set"]>;
  }

  export interface Context<T> {
    readonly key: symbol;
    readonly defaultValue: T;
    readonly Scope: (props: { value: unknown; children?: unknown }) => JSXElement;
  }

  type ForEachSource<T> = T[] | (() => T[]);

  type ForBaseProps<T> = {
    each: ForEachSource<T>;
    fallback?: unknown;
    children: (item: T, index: () => number) => unknown;
  };

  type KeyedForProps<T, K extends string | number> = ForBaseProps<T> & {
    by: (item: T, index: number) => K;
    byIndex?: never;
  };

  type IndexedForProps<T> = ForBaseProps<T> & {
    by?: never;
    byIndex: true;
  };

  export type ForProps<T, K extends string | number = string | number> =
    | KeyedForProps<T, K>
    | IndexedForProps<T>;

  export function state<T>(initialValue: T): State<T>;
  export function defineContext<T>(defaultValue: T): Context<T>;
  export function readContext<T>(context: Context<T>): T;
  export const For: <T, K extends string | number = string | number>(
    props: ForProps<T, K>,
  ) => JSXElement;
}

declare module "@askrjs/askr/jsx-runtime" {
  import type { JSXElement } from "@askrjs/askr/foundations";

  export const Fragment: symbol;
  export function jsx(
    type: unknown,
    props: Record<string, unknown>,
    key?: string | number,
  ): JSXElement;
  export const jsxs: typeof jsx;
}

declare module "@askrjs/askr/jsx-dev-runtime" {
  import type { JSXElement } from "@askrjs/askr/foundations";

  export const Fragment: symbol;
  export function jsxDEV(
    type: unknown,
    props: Record<string, unknown>,
    key?: string | number,
    isStaticChildren?: boolean,
    source?: unknown,
    self?: unknown,
  ): JSXElement;
}

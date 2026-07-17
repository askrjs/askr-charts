import type { PrimitiveComponent, PrimitiveKind } from "./model";

export interface PlotDescriptor<Props = Record<string, unknown>> {
  readonly kind: PrimitiveKind;
  readonly props: Readonly<Props>;
}

interface PrimitiveBrand {
  readonly factory: object;
  readonly kind: PrimitiveKind;
}

const primitiveBrands = new WeakMap<Function, PrimitiveBrand>();
const askrFragment = Symbol.for("askr.fragment");

export function createDescriptorComponent<Props>(
  factory: object,
  kind: PrimitiveKind,
): PrimitiveComponent<Props> {
  const component = function PlotPrimitive(): null {
    return null;
  } as unknown as PrimitiveComponent<Props>;
  Object.defineProperty(component, "name", {
    configurable: true,
    value: `Plot${kind}`,
  });
  primitiveBrands.set(component, Object.freeze({ factory, kind }));
  return component;
}

export function collectPlotDescriptors(
  factory: object,
  children: unknown,
): readonly PlotDescriptor[] {
  const result: PlotDescriptor[] = [];
  flatten(factory, children, result, new Set());
  return Object.freeze(result);
}

function flatten(
  factory: object,
  child: unknown,
  result: PlotDescriptor[],
  seen: Set<object>,
): void {
  if (child == null || typeof child === "boolean") return;

  if (Array.isArray(child)) {
    for (const item of child) flatten(factory, item, result, seen);
    return;
  }

  if (typeof child === "function") {
    if (child.length > 0) {
      throw new TypeError("Plot child getters must not require arguments.");
    }
    flatten(factory, child(), result, seen);
    return;
  }

  if (typeof child !== "object") {
    throw new TypeError(
      "Plot.Root children must be plot primitives, fragments, arrays, or conditional null values.",
    );
  }

  if (seen.has(child)) throw new TypeError("Circular plot child structure detected.");
  seen.add(child);

  const element = child as {
    type?: unknown;
    props?: Record<string, unknown>;
    children?: unknown;
  };
  if (element.type === askrFragment) {
    flatten(factory, element.props?.children ?? element.children, result, seen);
    seen.delete(child);
    return;
  }

  if (typeof element.type !== "function") {
    throw new TypeError("Plot.Root received a non-plot JSX child.");
  }
  const brand = primitiveBrands.get(element.type);
  if (!brand) {
    throw new TypeError("Plot.Root received a component that is not a plot primitive.");
  }
  if (brand.factory !== factory) {
    throw new TypeError(
      `Plot.Root cannot consume ${brand.kind} from a different createPlot() factory.`,
    );
  }
  result.push(
    Object.freeze({
      kind: brand.kind,
      props: Object.freeze({ ...element.props }),
    }),
  );
  seen.delete(child);
}

export function getPrimitiveBrand(component: unknown): PrimitiveBrand | undefined {
  return typeof component === "function" ? primitiveBrands.get(component) : undefined;
}

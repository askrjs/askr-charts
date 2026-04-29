import type { JSXElement } from "@askrjs/ui/foundations";

declare global {
  namespace JSX {
    interface Element extends JSXElement {
      readonly __askrChartsJsxElementBrand?: never;
    }

    interface IntrinsicElements {
      [elem: string]: Record<string, unknown>;
    }

    interface ElementAttributesProperty {
      props: Record<string, unknown>;
    }

    interface ElementChildrenAttribute {
      children: unknown;
    }
  }
}

export {};


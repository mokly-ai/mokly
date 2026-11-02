/** Stable refs for named package elements, scoped to one shell. */

import { createRef, type RefObject } from "react";

/** Keep the same ref for a name across renders and route changes. */
export class ElementRefs<Name extends string, Element extends HTMLElement> {
  private readonly refs = new Map<Name, RefObject<Element | null>>();

  ref = (name: Name): RefObject<Element | null> => {
    let ref = this.refs.get(name);
    if (!ref) {
      ref = createRef<Element>();
      this.refs.set(name, ref);
    }
    return ref;
  };

  values(): readonly (readonly [Name, Element])[] {
    return [...this.refs].flatMap(([name, ref]) =>
      ref.current ? [[name, ref.current] as const] : [],
    );
  }

  contains(target: Node): boolean {
    return this.values().some(([, element]) => element.contains(target));
  }
}

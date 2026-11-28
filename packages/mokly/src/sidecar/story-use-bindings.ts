import type { ReactNode } from "react";

import {
  forwardRefType,
  innerType,
  storyComponentType,
} from "./story-components.js";
import type { Props } from "./story-use-invocation.js";

function object(value: unknown): value is object {
  return (
    typeof value === "function" || (typeof value === "object" && value !== null)
  );
}

function classPrototype(type: object): object | undefined {
  const prototype: unknown = "prototype" in type ? type.prototype : undefined;
  if (object(prototype) && "isReactComponent" in prototype) return prototype;
}

export function reactClass(type: object): boolean {
  return classPrototype(type) !== undefined;
}

function classRender(type: object): unknown {
  const prototype = classPrototype(type);
  if (prototype && "render" in prototype) return prototype.render;
}

function* componentTypes(type: object): Generator<object> {
  const seen = new Set<object>();
  for (
    let current: object | undefined = type;
    current && !seen.has(current);
    current = innerType(current)
  ) {
    seen.add(current);
    yield current;
  }
}

export function refComponentKind(
  type: object,
): "forwardRef" | "class" | undefined {
  for (const component of componentTypes(type)) {
    if ("$$typeof" in component && component.$$typeof === forwardRefType)
      return "forwardRef";
    if (reactClass(component)) return "class";
  }
}

export class BodyBindings {
  private readonly marked = new WeakSet<object>();
  private readonly wrappers = new WeakMap<object, object>();

  mark(type: object, name?: string): void {
    if (name) Object.defineProperty(type, "name", { value: name });
    this.marked.add(type);
  }

  instrumented(type: object): boolean {
    for (const candidate of componentTypes(type)) {
      if (this.marked.has(candidate)) return true;
      const render = classRender(candidate);
      if (typeof render !== "function") continue;
      for (
        let parent: unknown = Object.getPrototypeOf(candidate);
        object(parent) && classRender(parent) === render;
        parent = Object.getPrototypeOf(parent)
      ) {
        if (this.marked.has(parent)) return true;
      }
    }
    return false;
  }

  matches(type: object, body: object): boolean {
    const render = classRender(body);
    for (const candidate of componentTypes(type)) {
      if (candidate === body) return true;
      if (typeof render === "function" && classRender(candidate) === render)
        return true;
    }
    return false;
  }

  binding(value: unknown, make: (original: object) => object): unknown {
    if (!storyComponentType(value) || this.instrumented(value)) return value;
    if (typeof value === "function") {
      if (
        /^class\s/u.test(Function.prototype.toString.call(value)) &&
        !reactClass(value)
      )
        return value;
    } else if (!innerType(value)) return value;
    const previous = this.wrappers.get(value);
    if (previous) return previous;
    const wrapper = make(value);
    this.wrappers.set(value, wrapper);
    this.mark(wrapper);
    return wrapper;
  }
}

/** Binding results and slot mirrors forward reads of component statics. */
export function mirrorStatics(
  render: (props: Props, ...extra: unknown[]) => ReactNode,
  original: unknown,
): typeof render {
  if (!object(original)) return render;
  return new Proxy(render, {
    get(target, key) {
      if (
        [
          "prototype",
          "caller",
          "arguments",
          "defaultProps",
          "$$typeof",
        ].includes(String(key))
      )
        return Reflect.get(target, key);
      return Reflect.has(original, key)
        ? Reflect.get(original, key, original)
        : Reflect.get(target, key);
    },
    has(target, key) {
      return Reflect.has(original, key) || Reflect.has(target, key);
    },
    set(_target, key, value) {
      return Reflect.set(original, key, value, original);
    },
  });
}

/** Count assertion access without replacing Node's methods or caller frames. */
import { fileURLToPath } from "node:url";

import { recordAssertion } from "./assertion-guard-state.mjs";

const constructors = new Set(["AssertionError", "Assert", "CallTracker"]);
const proxies = new WeakMap();
const ownPath = fileURLToPath(import.meta.url);

/** Reuse a counting Proxy for an assertion function or context assertion object. */
export default function countingAssertion(target) {
  const existing = proxies.get(target);
  if (existing) return existing;
  const proxy = new Proxy(target, {
    get(object, key, receiver) {
      const value = Reflect.get(object, key, receiver);
      if (key === "strict" && typeof value === "function")
        return countingAssertion(value);
      if (typeof value === "function" && !constructors.has(key))
        recordAssertion();
      return value;
    },
    apply(fn, thisArgument, args) {
      recordAssertion();
      try {
        return Reflect.apply(fn, thisArgument, args);
      } catch (error) {
        if (error instanceof Error && typeof error.stack === "string")
          error.stack = error.stack
            .split("\n")
            .filter((line) => !line.includes(ownPath))
            .join("\n");
        throw error;
      }
    },
  });
  proxies.set(target, proxy);
  return proxy;
}

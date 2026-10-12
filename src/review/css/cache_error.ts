/** Copy only measurable error data, never an opaque object's input references. */
import { types } from "node:util";

import { flatString } from "./byte_lru.js";
import { CssRuleParseError } from "./types.js";

const errorPrototypes = new Set([
  Error.prototype,
  TypeError.prototype,
  SyntaxError.prototype,
  RangeError.prototype,
  ReferenceError.prototype,
  URIError.prototype,
  EvalError.prototype,
  AggregateError.prototype,
  CssRuleParseError.prototype,
]);
const nativeStack = Object.getOwnPropertyDescriptor(new Error(), "stack");

/** A failed snapshot is uncacheable; the original parse error still serves the request. */
export function detachParseError(
  error: CssRuleParseError,
): { error: CssRuleParseError; stringUnits: number } | undefined {
  let stringUnits = 0;
  const ancestors = new Set<object>();
  const copyString = (text: string) => {
    stringUnits += text.length;
    return flatString(text);
  };
  const copy = (value: unknown): unknown => {
    if (typeof value === "string") return copyString(value);
    if (
      value === null ||
      value === undefined ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      return value;
    if (typeof value !== "object" || types.isProxy(value))
      throw new TypeError("Opaque error data");
    const prototype = Object.getPrototypeOf(value);
    const nativeError = errorPrototypes.has(prototype);
    if (
      ancestors.has(value) ||
      (!nativeError &&
        prototype !== Object.prototype &&
        prototype !== null &&
        prototype !== Array.prototype)
    )
      throw new TypeError("Opaque error data");
    ancestors.add(value);
    const result = nativeError
      ? stacklessError(prototype)
      : Array.isArray(value)
        ? []
        : Object.create(prototype);
    if (nativeError) delete result.stack;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new TypeError("Opaque error data");
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      let data: unknown;
      if ("value" in descriptor) data = descriptor.value;
      else if (
        nativeError &&
        key === "stack" &&
        descriptor.get === nativeStack?.get &&
        descriptor.set === nativeStack?.set
      )
        data = Reflect.get(value, key);
      else throw new TypeError("Opaque error data");
      stringUnits += key.length;
      Object.defineProperty(result, key, {
        value: copy(data),
        enumerable: descriptor.enumerable!,
      });
    }
    ancestors.delete(value);
    return Object.freeze(result);
  };
  try {
    return { error: copy(error) as CssRuleParseError, stringUnits };
  } catch {
    return undefined;
  }
}

function stacklessError(prototype: object): Error {
  const limit = Error.stackTraceLimit;
  try {
    Error.stackTraceLimit = 0;
    return Object.setPrototypeOf(new Error(), prototype) as Error;
  } finally {
    Error.stackTraceLimit = limit;
  }
}

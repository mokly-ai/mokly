import { createHash } from "node:crypto";
import { types } from "node:util";

import type { isValidElement } from "react";

export type IsElement = typeof isValidElement;
export type Scalar = boolean | number | string | null;
export type Field = [string | symbol, unknown];

const accessor = Symbol("accessor");

export function scalar(value: unknown): Scalar | undefined {
  if (value === undefined || value === null) return null;
  if (value === accessor) return "mokly:accessor";
  if (typeof value === "function") return "mokly:function";
  if (typeof value === "number")
    return Number.isFinite(value) ? value : `mokly:number:${value}`;
  if (typeof value === "bigint") return `mokly:bigint:${value}`;
  if (typeof value === "string")
    return value.isWellFormed()
      ? value
      : `mokly:string:${JSON.stringify(value)}`;
  if (typeof value === "boolean") return value;
}

export function elementText(
  value: object,
  isElement: IsElement,
): string | undefined {
  try {
    if (
      Object.getOwnPropertyDescriptor(value, "$$typeof")?.value &&
      isElement(value)
    )
      return "mokly:element";
  } catch {
    return undefined;
  }
}

export function objectText(
  value: object,
  isElement: IsElement,
): string | undefined {
  if (
    types.isDate(value) &&
    Number.isFinite(Date.prototype.getTime.call(value))
  )
    return Date.prototype.toISOString.call(value);
  return elementText(value, isElement);
}

export function enumerableFields(value: object): Field[] {
  const fields: Field[] = [];
  for (const name of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (descriptor?.enumerable)
      fields.push([name, "value" in descriptor ? descriptor.value : accessor]);
  }
  return fields;
}

export function arrayIndex(key: string, length: number): boolean {
  const index = Number(key);
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < length &&
    String(index) === key
  );
}

function constructorName(value: object): string {
  const prototype: object | null = Object.getPrototypeOf(value);
  if (prototype === null) return "Object";
  const constructor: unknown = Object.getOwnPropertyDescriptor(
    prototype,
    "constructor",
  )?.value;
  const name: unknown =
    typeof constructor === "function"
      ? Object.getOwnPropertyDescriptor(constructor, "name")?.value
      : undefined;
  return typeof name === "string" ? name : "Object";
}

function symbolRecord(value: symbol) {
  return ["symbol", Symbol.keyFor(value) ?? null, value.description ?? null];
}

function digestFields(value: object, length: number | null) {
  return enumerableFields(value)
    .filter(
      ([key, child]) =>
        child !== undefined &&
        !(
          child === null &&
          typeof key === "string" &&
          length !== null &&
          arrayIndex(key, length)
        ),
    )
    .map(([key, child]) => ({
      name: JSON.stringify(
        typeof key === "string" ? ["string", key] : symbolRecord(key),
      ),
      child,
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Hash the object graph without recursing through the input. */
export function propDigest(input: unknown, isElement: IsElement): string {
  const hash = createHash("sha256");
  const append = (token: unknown) => hash.update(JSON.stringify(token) + "\n");
  const ids = new Map<object, number>();
  const pending: object[] = [];
  function reference(value: unknown): unknown {
    if (typeof value === "symbol" && value !== accessor)
      return symbolRecord(value);
    if (value === null || typeof value !== "object") {
      const data = Object.is(value, -0)
        ? "-0"
        : typeof value === "string"
          ? value
          : scalar(value);
      return [typeof value, data];
    }
    const text = objectText(value, isElement);
    if (text !== undefined) return ["atomic-object", text];
    let id = ids.get(value);
    if (id === undefined) {
      id = pending.length;
      pending.push(value);
      ids.set(value, id);
    }
    return ["reference", id];
  }
  append(["mokly-story-prop-v1", reference(input)]);
  for (const value of pending) {
    try {
      const length = Array.isArray(value) ? value.length : null;
      const fields = digestFields(value, length);
      append([constructorName(value), length, fields.length]);
      for (const { name, child } of fields) append([name, reference(child)]);
      if (types.isMap(value)) {
        append(["map"]);
        for (const [key, child] of Map.prototype.entries.call(value))
          append([reference(key), reference(child)]);
      } else if (types.isSet(value)) {
        append(["set"]);
        for (const child of Set.prototype.values.call(value))
          append([reference(child)]);
      }
      append(["end"]);
    } catch {
      append(["unreadable-object"]);
    }
  }
  return `mokly:digest:${hash.digest("hex")}`;
}

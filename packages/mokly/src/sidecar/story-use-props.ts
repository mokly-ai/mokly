import {
  maxDataDepth,
  maxDataNodes,
  reservedDataKey,
} from "../authoring/data.js";

import {
  arrayIndex,
  elementText,
  enumerableFields,
  objectText,
  propDigest,
  scalar,
  type Field,
  type IsElement,
  type Scalar,
} from "./story-prop-values.js";

type Data = Scalar | Data[] | { [name: string]: Data };

interface CopyState {
  remaining: number;
  ancestors: Set<object>;
  isElement: IsElement;
}

class PropCycle extends Error {
  constructor(readonly value: object) {
    super("cyclic story prop");
  }
}

export function storyUseDataProps(
  props: Record<string, unknown>,
  isElement: IsElement,
): Record<string, unknown> {
  const entries: [string, unknown][] = [];
  for (const name of Object.keys(props).sort()) {
    const value = props[name];
    if (
      value === undefined ||
      typeof value === "function" ||
      (value !== null &&
        typeof value === "object" &&
        elementText(value, isElement))
    )
      continue;
    entries.push([name, value]);
  }

  let remaining = maxDataNodes - 1;
  if (entries.length > remaining || entries.some(([name]) => !dataKey(name)))
    return {
      "mokly:props": propDigest(Object.fromEntries(entries), isElement),
    };

  return Object.fromEntries(
    entries.map(([name, value], index) => {
      // Leave room for at least one value per remaining prop.
      const budget = remaining - (entries.length - index - 1);
      const state = {
        remaining: budget,
        ancestors: new Set<object>(),
        isElement,
      };
      let copied: Data | undefined;
      try {
        copied = copyValue(value, 1, state);
      } catch {
        // Reflection on a proxy can fail. Record the digest form in that case.
      }
      remaining -= copied === undefined ? 1 : budget - state.remaining;
      return [
        name,
        copied === undefined ? propDigest(value, isElement) : copied,
      ];
    }),
  );
}

function copyValue(
  value: unknown,
  depth: number,
  state: CopyState,
): Data | undefined {
  if (depth > maxDataDepth || --state.remaining < 0) return;
  const atom = scalar(value);
  if (atom !== undefined) return atom;
  if (value === null || typeof value !== "object")
    return propDigest(value, state.isElement);
  const text = objectText(value, state.isElement);
  if (text !== undefined) return text;
  if (state.ancestors.has(value)) throw new PropCycle(value);

  const array = Array.isArray(value);
  const prototype: object | null = Object.getPrototypeOf(value);
  if (!array && prototype !== Object.prototype && prototype !== null)
    return propDigest(value, state.isElement);
  if (Object.getOwnPropertyNames(value).some(reservedDataKey))
    return propDigest(value, state.isElement);

  const fields = enumerableFields(value);
  const length = array ? value.length : 0;
  if (
    fields.some(
      ([name]) => !dataKey(name) || (array && !arrayIndex(name, length)),
    )
  )
    return propDigest(value, state.isElement);

  state.ancestors.add(value);
  const remaining = state.remaining;
  const childDepth = depth + 1;
  try {
    return array
      ? copyArray(fields, length, childDepth, state)
      : copyObject(fields, childDepth, state);
  } catch (error) {
    if (!(error instanceof PropCycle) || error.value !== value) throw error;
    state.remaining = remaining;
    return propDigest(value, state.isElement);
  } finally {
    state.ancestors.delete(value);
  }
}

function copyArray(
  fields: Field[],
  length: number,
  depth: number,
  state: CopyState,
) {
  if (length > state.remaining) return;
  const values = new Map(fields);
  const result: Data[] = [];
  for (let index = 0; index < length; index++) {
    const child = copyValue(values.get(String(index)), depth, state);
    if (child === undefined) return;
    result.push(child);
  }
  return result;
}

function copyObject(fields: Field[], depth: number, state: CopyState) {
  const result: [string, Data][] = [];
  for (const [name, value] of fields) {
    if (value === undefined || typeof name !== "string") continue;
    const child = copyValue(value, depth, state);
    if (child === undefined) return;
    result.push([name, child]);
  }
  return Object.fromEntries(result);
}

function dataKey(key: string | symbol): key is string {
  return typeof key === "string" && key.isWellFormed() && !reservedDataKey(key);
}

import { createHash } from "node:crypto";

export class DataError extends Error {
  constructor(
    readonly path: string,
    reason: string,
  ) {
    super(`${path || "/"}: ${reason}`);
  }
}

/** Validate and copy data without invoking accessors or retaining caller state. */
export function copyData(value: unknown, allowReservedKeys = false): unknown {
  let nodes = 0;
  const seen = new Set<object>();
  function visit(input: unknown, depth: number, at: string): unknown {
    if (++nodes > 10_000 || depth > 64)
      throw new DataError(at, "data exceeds its bounds");
    if (
      input === null ||
      typeof input === "string" ||
      typeof input === "boolean"
    )
      return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input !== "object" || input === null || seen.has(input))
      throw new DataError(at, "value is not plain data");
    const array = Array.isArray(input);
    const proto = Object.getPrototypeOf(input);
    if (
      (!array && proto !== Object.prototype && proto !== null) ||
      Object.getOwnPropertySymbols(input).length
    )
      throw new DataError(at, "value is not plain data");
    seen.add(input);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const output: Record<string, unknown> = Object.create(null);
    for (const key of Object.getOwnPropertyNames(input)) {
      if (array && key === "length") continue;
      const descriptor = descriptors[key]!;
      if (
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        (!allowReservedKeys &&
          ["__proto__", "constructor", "prototype"].includes(key))
      )
        throw new DataError(
          `${at}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
          "invalid data property",
        );
      output[key] = visit(
        descriptor.value,
        depth + 1,
        `${at}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
      );
    }
    seen.delete(input);
    if (!array) return output;
    if (
      Object.keys(output).length !== input.length ||
      Array.from({ length: input.length }, (_, i) => String(i)).some(
        (key) => !Object.hasOwn(output, key),
      )
    )
      throw new DataError(
        at,
        "array must be dense and have no extra properties",
      );
    return Array.from({ length: input.length }, (_, i) => output[String(i)]);
  }
  return visit(value, 0, "");
}

/** Canonical tagged values preserve negative zero and UTF-16 key ordering. */
export function encodeData(value: unknown): unknown {
  if (value === null) return ["null"];
  if (typeof value === "number")
    return ["number", Object.is(value, -0) ? "-0" : String(value)];
  if (typeof value === "string" || typeof value === "boolean")
    return [typeof value, value];
  if (Array.isArray(value)) return ["array", value.map(encodeData)];
  const data = value as Record<string, unknown>;
  return [
    "object",
    Object.keys(data)
      .sort()
      .map((key) => [key, encodeData(data[key])]),
  ];
}

export function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Hash structured data with the canonical props value encoding. */
export function reviewMaterialKey(value: unknown): string {
  return digest(encodeData(copyData(value)));
}

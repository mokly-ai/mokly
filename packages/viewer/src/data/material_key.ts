import { sha256 } from "./sha256.js";

type StableValue =
  | ["array", StableValue[]]
  | ["boolean", boolean]
  | ["null"]
  | ["number", string]
  | ["object", Array<[string, StableValue]>]
  | ["string", string]
  | ["undefined"];

/** Hash plain structured state into a deterministic Review material key. */
export function reviewMaterialKey(value: object): string {
  const serialized = JSON.stringify(stableValue(value, "$", new Set<object>()));
  return sha256(serialized);
}

function stableValue(
  value: unknown,
  at: string,
  ancestors: Set<object>,
): StableValue {
  if (value === undefined) return ["undefined"];
  if (value === null) return ["null"];
  if (typeof value === "string") return ["string", value];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw materialError(at, "numbers must be finite");
    return ["number", Object.is(value, -0) ? "-0" : String(value)];
  }
  if (typeof value !== "object")
    throw materialError(at, `unsupported ${typeof value} value`);
  if (ancestors.has(value))
    throw materialError(at, "cyclic values are not supported");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return [
        "array",
        value.map((item, index) =>
          stableValue(item, `${at}[${index}]`, ancestors),
        ),
      ];
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw materialError(at, "only plain objects and arrays are supported");
    }
    const record = value as Record<string, unknown>;
    return [
      "object",
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => [
          key,
          stableValue(record[key], `${at}.${key}`, ancestors),
        ]),
    ];
  } finally {
    ancestors.delete(value);
  }
}

function materialError(at: string, detail: string): MoklyMaterialError {
  return new MoklyMaterialError(`[mokly/review-material] ${at}: ${detail}`);
}

class MoklyMaterialError extends Error {}

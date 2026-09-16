import { isSafeRepositoryPath } from "../data/paths.js";

import { exactKeys, invalidData } from "./data.js";
import type { ComponentSourceLocation } from "./manifest_types.js";

/** Validate normalized invocation metadata at both wrapper and manifest boundaries. */
export function validateComponentSource(
  value: unknown,
  at: string,
): asserts value is ComponentSourceLocation {
  exactKeys(value, ["path", "line", "column"], at);
  if (typeof value.path !== "string" || !isSafeRepositoryPath(value.path))
    invalidData(
      at,
      "source path must be repository-relative and POSIX-normalized",
    );
  for (const field of ["line", "column"] as const)
    if (
      typeof value[field] !== "number" ||
      !Number.isSafeInteger(value[field]) ||
      value[field] < 1
    )
      invalidData(at, `source ${field} must be a positive safe integer`);
}

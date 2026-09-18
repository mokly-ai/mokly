import { isSafeRepositoryPath } from "../data/paths.js";

import { invalidData } from "./data.js";

export function sortedStrings(
  value: unknown,
  at: string,
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !item.length)
  )
    invalidData(at, "expected nonempty strings");
  for (let i = 1; i < value.length; i++)
    if (value[i - 1]! >= value[i]!)
      invalidData(at, "values must be sorted and unique");
}

export function validateResourcePath(
  value: unknown,
  at: string,
): asserts value is string {
  if (typeof value !== "string" || !isSafeRepositoryPath(value))
    invalidData(at, "unsafe resource path");
}

/**
 * An entry detail's `reasons`: the review v8 reason shapes, sorted and unique
 * in the canonical reason order. Like the detail's other records, a reason
 * ignores a field that a newer writer adds, but a target field of another
 * kind contradicts its own kind and is invalid.
 */

import { invalidData } from "../components/data.js";
import type { EntryChangeReason } from "../generated/catalogue/EntryChangeReason.js";

import { reasonsInOrder } from "./reason_order.js";
import { array, choice, entryPath, object, repositoryPath } from "./values.js";

const KINDS = [
  "added",
  "removed",
  "metadata",
  "material",
  "implementation",
  "inputs",
  "structure",
  "dependency",
  "screen",
] as const;

/** Read the reasons of one detail, rejecting any out of canonical order. */
export function readDetailReasons(value: unknown): EntryChangeReason[] {
  const reasons = array(value).map(readReason);
  if (!reasonsInOrder(reasons))
    invalidData("$detail.reasons", "reasons must be sorted and unique");
  return reasons;
}

function readReason(value: unknown): EntryChangeReason {
  const input = object(value);
  const kind = choice(input.kind, KINDS);
  if (kind !== "dependency" && Object.hasOwn(input, "path"))
    invalidData("$detail.reasons", "only a dependency reason names a path");
  if (kind !== "screen" && Object.hasOwn(input, "screenPath"))
    invalidData("$detail.reasons", "only a screen reason names a screen");
  if (kind === "dependency") return { kind, path: repositoryPath(input.path) };
  if (kind === "screen")
    return { kind, screenPath: entryPath(input.screenPath) };
  return { kind };
}

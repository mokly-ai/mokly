import assert from "node:assert/strict";

import { VARIANT_PARENT } from "../../packages/mokly/dist/authoring/markers.js";
import type {
  EntryDefinition,
  ResolvedRegistryEntry,
} from "../../packages/mokly/dist/authoring/types.js";

/** Attach registry context to deliberately explicit-path unit definitions. */
export function resolvedEntry(
  definition: EntryDefinition,
  sourceRelativePath: string,
): ResolvedRegistryEntry {
  const parent = definition[VARIANT_PARENT];
  const entryPath = parent
    ? `${parent.path}/${definition.slug}`
    : definition.path;
  assert.equal(typeof entryPath, "string");
  return {
    ...definition,
    path: entryPath!,
    slug: definition.slug ?? entryPath!.split("/").at(-1)!,
    index: false,
    linkBase: entryPath!.split("/").slice(0, -1).join("/"),
    location: `${sourceRelativePath} export default`,
    sourcePath: sourceRelativePath,
    sourceRelativePath,
    ...(parent?.path ? { variantOf: parent.path } : {}),
  };
}

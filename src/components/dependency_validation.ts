/** Declaration invariants apply before any rendered usage is available. */
import type { ManifestV7 } from "@mokly/viewer/data";
import {
  canonicalJson,
  invalidData,
  isManifestComponentVariant,
  sortedStrings,
} from "@mokly/viewer/data";

export function validateDependencyDeclarations(
  entry: ManifestV7["entries"][number],
): void {
  sortedStrings(entry.declaredDependencies, `${entry.id}.declaredDependencies`);
  if (
    canonicalJson(entry.dependencies) !==
    canonicalJson(
      [...new Set([entry.sourcePath, ...entry.declaredDependencies])].sort(),
    )
  )
    invalidData(
      entry.id,
      "dependencies must retain exactly the declared paths and source attribution",
    );
  if (
    entry.kind === "component" &&
    !isManifestComponentVariant(entry) &&
    !entry.ownedDependencies.every((dependency) =>
      entry.declaredDependencies.includes(dependency),
    )
  )
    invalidData(entry.id, "owned dependencies require an explicit declaration");
}

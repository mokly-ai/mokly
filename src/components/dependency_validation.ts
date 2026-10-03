/** Declaration invariants apply before any rendered usage is available. */
import type { ManifestV8 } from "@mokly/viewer/data";
import {
  invalidData,
  isManifestComponentVariant,
  sortedStrings,
} from "@mokly/viewer/data";

export function validateDependencyDeclarations(
  entry: ManifestV8["entries"][number],
): void {
  sortedStrings(entry.declaredDependencies, `${entry.id}.declaredDependencies`);
  if (
    entry.kind === "component" &&
    !isManifestComponentVariant(entry) &&
    !entry.ownedDependencies.every((dependency) =>
      entry.declaredDependencies.includes(dependency),
    )
  )
    invalidData(entry.id, "owned dependencies require an explicit declaration");
}

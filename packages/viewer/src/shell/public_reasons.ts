/** The reasons that Details shows for one routed record of the catalogue. */

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import type { ChangeKind } from "../catalogue/types.js";
import type { EntryChangeReason } from "../generated/catalogue/EntryChangeReason.js";

/**
 * The routed detail's reasons that Details shows. A record outside Changes
 * shows none. A reason that contradicts its record is dropped and the detail
 * still loads: `removed` needs a removed record, `added` a current record
 * that Changes reads as added, `screen` a use case, and `implementation` a
 * component parent.
 */
export function shownReasons(
  record: ShellCatalogueRoutedEntry,
  removed: boolean,
  reasons: readonly EntryChangeReason[] | undefined,
): readonly EntryChangeReason[] | undefined {
  const changes = record.changes;
  if (!reasons || changes.status !== "ready" || !changes.included)
    return undefined;
  return reasons.filter((reason) =>
    fits(record, removed, changes.kind, reason),
  );
}

function fits(
  record: ShellCatalogueRoutedEntry,
  removed: boolean,
  kind: ChangeKind,
  reason: EntryChangeReason,
): boolean {
  switch (reason.kind) {
    case "removed":
      return removed;
    case "added":
      return !removed && kind === "added";
    case "screen":
      return record.kind === "use-case";
    case "implementation":
      return record.kind === "component" && record.variantOf === undefined;
    default:
      return true;
  }
}

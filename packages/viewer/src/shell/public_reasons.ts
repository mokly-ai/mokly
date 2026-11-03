/** The reasons that Details shows for one routed record of the catalogue. */

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import type { EntryChangeReason } from "../generated/catalogue/EntryChangeReason.js";

/**
 * The routed detail's reasons that Details shows. Only a record that Changes
 * lists shows reasons; a record outside Changes shows none.
 */
export function shownReasons(
  record: ShellCatalogueRoutedEntry,
  reasons: readonly EntryChangeReason[] | undefined,
): readonly EntryChangeReason[] | undefined {
  const changes = record.changes;
  return reasons && changes.status === "ready" && changes.included
    ? reasons
    : undefined;
}

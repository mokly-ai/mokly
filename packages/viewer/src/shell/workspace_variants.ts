/** The variant bar rows of a component workspace. */

import type { ShellCatalogueComponent } from "../catalogue/scoped_types.js";

import type { EntryStatus } from "./view_status.js";

/** One row of a component page's variant bar: the parent's own entry or a variant. */
export interface WorkspaceVariant {
  value: ShellCatalogueComponent;
  removed: boolean;
  comparisonEligible: boolean;
  snapshotId?: string;
  status?: EntryStatus;
}

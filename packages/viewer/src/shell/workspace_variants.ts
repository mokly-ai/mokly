/** The rows of a component workspace's variant set. */

import type { ShellCatalogueComponent } from "../catalogue/scoped_types.js";

import type { EntryStatus } from "./view_status.js";

/** One row of a component's variant set: the parent's own entry or a variant. */
export interface WorkspaceVariant {
  value: ShellCatalogueComponent;
  removed: boolean;
  comparisonEligible: boolean;
  snapshotId?: string;
  status?: EntryStatus;
}

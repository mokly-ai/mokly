/** Serializable, source-derived state shared by every delivery's inspector. */

import type { EntryDetailV2, InputChange } from "../catalogue/types.js";
import type { ManifestComponent } from "../components/manifest_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import type {
  EntryChangeReason,
  ViewResourceEvidence,
} from "../review/types.js";
import { publicWorkspace } from "../viewer/public_workspace.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { EntryStatus, ViewStatesBySelection } from "./view_status.js";
import type { WorkspaceEntry } from "./workspace_entry.js";
import type { UsageLink } from "./workspace_usage_data.js";
import type { WorkspaceVariant } from "./workspace_variants.js";
import type { ChangedViewsBySelection } from "./workspace_views_data.js";

export type { EntryStatus } from "./view_status.js";
export type { WorkspaceVariant } from "./workspace_variants.js";
export type { UsageLink } from "./workspace_usage_data.js";
export interface WorkspaceData {
  controlOrder?: EntryDetailV2["controlOrder"];
  /** False when no detail carried the Usage lists of this entry. */
  usageComplete?: boolean;
  /** Selected views are waiting for the routed entry's detail. */
  viewUsagePending?: boolean;
  /** The exact routed entry whose chrome and lifecycle own this workspace. */
  entry: WorkspaceEntry;
  /** Parent schema and controls for a component parent or variant route. */
  component?: ManifestComponent;
  components: readonly Pick<ManifestComponent, "path" | "title">[];
  views: readonly GeneratedComponentView[];
  /**
   * Canonically ordered changed views, keyed by saved-variant id for a
   * component and by the entry id for a screen.
   */
  changedViews: ChangedViewsBySelection;
  /**
   * Known review states keyed by saved-variant id for a component and by the
   * entry id for a screen. A missing key means the per-view state is unknown.
   */
  viewStates: ViewStatesBySelection;
  variants: readonly WorkspaceVariant[];
  usedBy: readonly UsageLink[];
  affected: readonly UsageLink[];
  status?: EntryStatus;
  /** Whether Changes lists the routed entry; absent until Changes is ready. */
  included?: boolean;
  /**
   * The routed entry's direct reasons from its detail, while Changes is
   * ready and includes it; a pure move has none.
   */
  reasons?: readonly EntryChangeReason[];
  /**
   * A shown view's entry-detail evidence keeps a retained rule or a resource
   * that a component owns.
   */
  componentRecords?: boolean;
  resourceEvidence?: readonly ViewResourceEvidence[];
  base: string;
  comparisons: boolean;
  comparisonEligible: boolean;
  removed: boolean;
  relatedComponents: readonly { path: string; title: string }[];
  inputChanges: readonly InputChange[];
}

/**
 * The routed entry's workspace, projected from the published index and the
 * routed entry's detail. Entry state and actual saved views stay independent
 * of Changes membership. Every catalogue of a delivery carries its published
 * records.
 */
export function workspaceData(
  catalogue: Catalogue,
  context: ShellContext,
  entry: WorkspaceData["entry"],
): WorkspaceData {
  const model = catalogue.publicModel;
  if (!model) throw new Error("The catalogue has no published records.");
  return publicWorkspace(
    catalogue,
    model,
    entry,
    context.comparisons ?? model.comparisonUrl !== null,
    context.snapshotId,
    context.base,
  );
}

import type { CatalogueReadModel } from "../catalogue/types.js";
import type { RenderCapability } from "../components/render_types.js";
import type { StaticDelivery } from "../navigation/delivery.js";
import type { ViewerTheme } from "../viewer/types.js";

import type { ShellEvidence, LiveChangesStatus } from "./metadata.js";

/** Server-side context shared by every shell page. */
export interface ShellContext {
  /** Accepted public snapshot supplied by the first-party server integration. */
  readModel?: CatalogueReadModel;
  /** Revision of the rendered content, independent of background evidence. */
  contentVersion?: number;
  /** Generation accepted by the on-demand document service. */
  previewGeneration?: string;
  /** Live calculation state; omitted by static catalogues without Changes. */
  changesStatus?: LiveChangesStatus;
  /** Authenticated temporary renderer, independent of document availability. */
  renderCapability?: RenderCapability;
  /** Validated delivery information for a static export. */
  delivery?: StaticDelivery;
  /** Id of the currently selected catalogue entry, when one is active. */
  activeId?: string;
  /** Review comparison base ref for the serve session. */
  base: string;
  /** Interface appearance the document starts from; omission means `auto`. */
  theme?: ViewerTheme;
  /**
   * True inside an embedding host, which supplies the appearance itself and
   * keeps the viewer's own preview controls. A standalone document instead
   * shows the one Appearance control.
   */
  embedded?: boolean;
  /** Entry ids changed since the base-ref branch point; absent when unknown. */
  changedIds?: readonly string[];
  /** Whether on-demand comparison serving is available. */
  comparisons?: boolean;
  /** Validated lightweight component evidence, independent of snapshots. */
  componentChanges?: ShellEvidence;
  /** Validated logical fragment applied to the routed target's frames. */
  fragment?: string;
  /** Exact removed record selected for this route. */
  snapshotId?: string;
  /** Update-stream version captured when this page request began. */
  updateVersion: number;
}

/** Create one page context from the current mutable server snapshot. */
export function shellContext(
  base: string,
  changedIds: readonly string[] | undefined,
  updateVersion: number,
): ShellContext {
  return {
    base,
    ...(changedIds ? { changedIds } : {}),
    updateVersion,
  };
}

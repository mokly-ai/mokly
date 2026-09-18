import type { CatalogueReadModel } from "../catalogue/types.js";
import type { RenderCapability } from "../components/render_types.js";
import type { StaticDelivery } from "../navigation/delivery.js";

import type { ShellEvidence } from "./metadata.js";
import type { LiveChangesStatus } from "./metadata.js";

/** Server-side context shared by every served Mokly shell page. */

/** Server-side context shared by every shell page. */
export interface ShellContext {
  /** Accepted public snapshot supplied by the first-party server integration. */
  readModel?: CatalogueReadModel;
  /** Revision of the rendered content, independent of background evidence. */
  contentVersion?: number;
  /** Retained on-demand renderer used even after exhaustive Usage completes. */
  previewGeneration?: string;
  /** Live calculation state; omitted by static catalogues without Changes. */
  changesStatus?: LiveChangesStatus;
  renderCapability?: RenderCapability;
  /** Validated delivery information for a static export. */
  delivery?: StaticDelivery;
  /** Route of the currently selected catalogue entry, when one is active. */
  activeRoute?: string;
  /** Review comparison base ref for the serve session. */
  base: string;
  /** Routes changed since the base-ref branch point; absent when unknown. */
  changedRoutes?: readonly string[];
  /** Whether on-demand comparison serving is available. */
  comparisons?: boolean;
  /** Validated lightweight component evidence, independent of snapshots. */
  componentChanges?: ShellEvidence;
  /** Validated logical fragment applied to the routed target's frames. */
  fragment?: string;
  /** Update-stream version captured when this page request began. */
  updateVersion: number;
}

/** Create one page context from the current mutable server snapshot. */
export function shellContext(
  base: string,
  changedRoutes: readonly string[] | undefined,
  updateVersion: number,
): ShellContext {
  return {
    base,
    ...(changedRoutes ? { changedRoutes } : {}),
    updateVersion,
  };
}

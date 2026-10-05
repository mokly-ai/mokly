/** Atomic public-catalogue publication for one accepted Serve update. */

import type { CatalogueUpdateState } from "./catalogue_update.js";
import { advanceCatalogueState } from "./catalogue_update.js";
import type { LivePublicCatalogue } from "./public_catalogue.js";
import { livePublicInput } from "./review_sources.js";
import type { CatalogueUpdate, ChangesStatus } from "./update_messages.js";

/** Hide unused Changes state only for a deterministic server without Review. */
export function publicChangesStatus(
  liveChanges: boolean | undefined,
  review: boolean,
  ids: readonly string[] | undefined,
  hasEvidence: boolean,
  status: ChangesStatus,
  preserveUnavailable = false,
): ChangesStatus | "disabled" {
  return liveChanges === false &&
    !review &&
    !ids &&
    !hasEvidence &&
    !(preserveUnavailable && status === "unavailable")
    ? "disabled"
    : status;
}

/** Advance, project and publish an update without exposing partial state. */
export function publishCatalogueUpdate(
  current: CatalogueUpdateState,
  update: CatalogueUpdate,
  publicCatalogue: LivePublicCatalogue,
  liveChanges: boolean | undefined,
  review: boolean,
  preserveUnavailable = false,
): CatalogueUpdateState | undefined {
  const next = advanceCatalogueState(current, update);
  if (!next) return;
  publicCatalogue.publish(
    livePublicInput(
      next.activeCatalogue,
      publicChangesStatus(
        liveChanges,
        review,
        next.changedEntries,
        next.componentChanges !== undefined,
        next.changesStatus,
        preserveUnavailable,
      ),
      next.changedEntries,
      next.componentChanges,
      undefined,
    ),
    next.contentVersion,
    update.kind === "evidence",
  );
  return next;
}

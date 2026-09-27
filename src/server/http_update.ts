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
  routes: readonly string[] | undefined,
  hasEvidence: boolean,
  status: ChangesStatus,
): ChangesStatus | "disabled" {
  return liveChanges === false && !review && !routes && !hasEvidence
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
): CatalogueUpdateState | undefined {
  const next = advanceCatalogueState(current, update);
  if (!next) return;
  publicCatalogue.publish(
    livePublicInput(
      next.activeCatalogue,
      publicChangesStatus(
        liveChanges,
        review,
        next.changedRoutes,
        next.componentChanges !== undefined,
        next.changesStatus,
      ),
      next.changedRoutes,
      next.componentChanges,
      undefined,
    ),
    next.contentVersion,
    update.kind === "evidence",
  );
  return next;
}

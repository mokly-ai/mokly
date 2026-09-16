import { type Catalogue } from "@mokly/viewer/server";

import { catalogueAtBaseline } from "./baseline_catalogue.js";
import type { ComponentChangeSnapshot } from "./component_changes.js";
import type { CatalogueUpdate, ChangesStatus } from "./update_messages.js";

export interface CatalogueUpdateState {
  catalogue: Catalogue;
  activeCatalogue: Catalogue;
  changedRoutes: readonly string[] | undefined;
  componentChanges: ComponentChangeSnapshot | undefined;
  changesStatus: ChangesStatus;
  updateVersion: number;
  contentVersion: number;
}

/** Prepare an entire update before any public snapshot or shell state is replaced. */
export function advanceCatalogueState(
  current: CatalogueUpdateState,
  update: CatalogueUpdate,
): CatalogueUpdateState | undefined {
  const version = update.version ?? current.updateVersion + 1;
  if (!Number.isSafeInteger(version) || version <= current.updateVersion)
    return;
  const next: CatalogueUpdateState = {
    ...current,
    updateVersion: version,
    contentVersion:
      update.kind === "evidence" ? current.contentVersion : version,
  };
  if (Object.hasOwn(update, "changedRoutes"))
    next.changedRoutes = update.changedRoutes ?? undefined;
  if (Object.hasOwn(update, "componentChanges")) {
    next.componentChanges = update.componentChanges ?? undefined;
    next.activeCatalogue = next.componentChanges
      ? catalogueAtBaseline(
          current.catalogue.manifest,
          next.componentChanges.baseline,
        )
      : current.catalogue;
  }
  if (
    Object.hasOwn(update, "changedRoutes") ||
    Object.hasOwn(update, "componentChanges")
  )
    next.changesStatus =
      next.changedRoutes || next.componentChanges ? "ready" : "unavailable";
  next.changesStatus = update.changesStatus ?? next.changesStatus;
  if (next.changesStatus !== "ready") {
    next.changedRoutes = undefined;
    next.componentChanges = undefined;
    next.activeCatalogue = current.catalogue;
  }
  return next;
}

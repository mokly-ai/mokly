import { type Catalogue } from "@mokly/viewer/server";

import { includeMovedEntries } from "../review/moves/entries.js";

import { catalogueWithChanges } from "./baseline_catalogue.js";
import type { ComponentChangeSnapshot } from "./component_change_types.js";
import type { CatalogueUpdate, ChangesStatus } from "./update_messages.js";

export interface CatalogueUpdateState {
  catalogue: Catalogue;
  activeCatalogue: Catalogue;
  changedEntries: readonly string[] | undefined;
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
  if (Object.hasOwn(update, "changedEntries"))
    next.changedEntries = update.changedEntries ?? undefined;
  if (Object.hasOwn(update, "componentChanges")) {
    next.componentChanges = update.componentChanges ?? undefined;
    next.activeCatalogue = next.componentChanges
      ? catalogueWithChanges(current.catalogue.manifest, next.componentChanges)
      : current.catalogue;
  }
  if (
    Object.hasOwn(update, "changedEntries") ||
    Object.hasOwn(update, "componentChanges")
  )
    next.changesStatus =
      next.changedEntries || next.componentChanges ? "ready" : "unavailable";
  next.changesStatus = update.changesStatus ?? next.changesStatus;
  next.changedEntries = includeMovedEntries(
    next.changedEntries,
    next.componentChanges?.pairing?.moves,
  );
  if (next.changesStatus !== "ready") {
    next.changedEntries = undefined;
    next.componentChanges = undefined;
    next.activeCatalogue = current.catalogue;
  }
  return next;
}

/** Resolve the shared shell context and route from validated public data. */

import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import type { ViewerSelection } from "../host/types.js";

import type { ShellContext } from "./context.js";

export function shellContext(
  model: ShellCatalogueReadModel,
  selection: Pick<ViewerSelection, "screenPath" | "snapshotId">,
): Omit<ShellContext, "embedded" | "theme"> {
  const resolved =
    typeof selection.screenPath === "string"
      ? resolveCatalogueSelection(
          model,
          selection.screenPath,
          selection.snapshotId,
        )
      : undefined;
  const selected = resolved?.entry;
  return {
    base: model.base ?? "",
    comparisons:
      model.comparisonUrl !== null ||
      (model.live !== undefined && model.changesStatus !== "disabled"),
    ...(model.changesStatus === "disabled"
      ? {}
      : { changesStatus: model.changesStatus }),
    ...(selected ? { activeId: selected.path } : {}),
    ...(resolved?.snapshotId ? { snapshotId: resolved.snapshotId } : {}),
    ...(model.changesStatus === "ready" ? changedEntryLists(model) : {}),
  };
}

function changedEntryLists(model: ShellCatalogueReadModel) {
  const changedEntries: string[] = [];
  const materialEntries: string[] = [];
  const lists = [
    model.screens,
    model.pages,
    model.documents,
    model.useCases,
    model.components,
    model.removedEntries.map(({ entry }) => entry),
  ];
  for (const list of lists) {
    for (const { path, changes } of list) {
      if (changes.status !== "ready") continue;
      if (changes.included) changedEntries.push(path);
      if (changes.kind !== "unmodified") materialEntries.push(path);
    }
  }
  return { changedEntries, materialEntries };
}

/** Resolve the shared shell context and route from validated public data. */

import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import type { ViewerSelection } from "../host/types.js";

import type { ShellContext } from "./context.js";

export function shellContext(
  model: ShellCatalogueReadModel,
  selection: ViewerSelection,
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
  const ready = [
    ...model.screens,
    ...model.pages,
    ...model.documents,
    ...model.useCases,
    ...model.components,
    ...model.removedEntries.map(({ entry }) => entry),
  ].flatMap(({ path, changes }) =>
    changes.status === "ready" ? [{ path, ...changes }] : [],
  );
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
    ...(model.changesStatus === "ready"
      ? {
          changedEntries: ready
            .filter(({ included }) => included)
            .map(({ path }) => path),
          materialEntries: ready
            .filter(({ kind }) => kind !== "unmodified")
            .map(({ path }) => path),
        }
      : {}),
  };
}

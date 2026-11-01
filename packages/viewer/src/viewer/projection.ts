/** Resolve the shared shell context and route from validated public data. */

import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import { catalogueRouteEntry, type Catalogue } from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { toRouteTarget } from "../shell/target.js";
import type { ShellView } from "../shell/views.js";

import type { ViewerSelection } from "./types.js";

export function viewerContext(
  model: ShellCatalogueReadModel,
  selection: ViewerSelection,
): ShellContext {
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
    embedded: true,
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

export function viewerView(
  catalogue: Catalogue,
  selection: ViewerSelection,
): ShellView {
  if (selection.screenPath === null) return { kind: "home" };
  const selected = resolveCatalogueSelection(
    catalogue.publicModel,
    selection.screenPath,
    selection.snapshotId,
  );
  const entry = selected
    ? catalogueRouteEntry(catalogue, selected.entry.path, selected.entry.kind)
    : undefined;
  const target = entry && toRouteTarget(entry);
  return target
    ? { kind: "target", target }
    : { kind: "missing", requested: selection.screenPath };
}

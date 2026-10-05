/** Convert validated public data to the existing shell's display records. */

import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueView,
} from "../catalogue/scoped_types.js";
import type { CatalogueEntry } from "../catalogue/types.js";
import type {
  ComponentViewRecord,
  ManifestComponentVariant,
} from "../components/manifest_types.js";
import type { ManifestEntry } from "../registry/types.js";
import { catalogueRouteEntry, createCatalogue } from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { toRouteTarget } from "../shell/target.js";
import type { ShellView } from "../shell/views.js";

import { adoptCatalogueTree } from "./catalogue_tree.js";
import type { ViewerSelection } from "./types.js";

function metadata(entry: CatalogueEntry) {
  return {
    path: entry.path,
    title: entry.title,
    tags: entry.tags,
    ...entry.details,
    declaredDependencies: entry.details.dependencies,
  };
}

function usageView(view: ShellCatalogueView): ComponentViewRecord | undefined {
  if (view.usage.status !== "ready") return;
  return {
    viewport: view.viewport,
    colorScheme: view.colorScheme,
    instances: view.usage.instances,
    slots: view.usage.slots,
    ranges: view.usage.ranges,
    styles: [],
    resources: [],
  };
}

export function displayEntry(entry: ShellCatalogueRoutedEntry): ManifestEntry {
  const base = { ...metadata(entry) };
  switch (entry.kind) {
    case "document":
      return {
        ...base,
        kind: "document",
        colorSchemes: entry.colorSchemes,
        resources: [],
      };
    case "page":
      return { ...base, kind: "page" };
    case "use-case":
      return { ...base, kind: "use-case", steps: entry.steps };
    case "screen":
      return {
        ...base,
        colorSchemes: entry.colorSchemes,
        kind: "screen",
        componentViews: entry.views.flatMap((view) => usageView(view) ?? []),
        useCasePaths: entry.useCasePaths,
        ...(entry.address ? { address: entry.address } : {}),
        ...(entry.variantOf !== undefined
          ? { variantOf: entry.variantOf }
          : {}),
      };
    case "component":
      if ("variantOf" in entry)
        return {
          ...base,
          colorSchemes: entry.colorSchemes,
          componentViews: entry.views.flatMap((view) => usageView(view) ?? []),
          kind: "component",
          variantOf: entry.variantOf,
          props: entry.props,
          suppliedSlots: entry.suppliedSlots,
        } as ManifestComponentVariant;
      return {
        ...base,
        colorSchemes: entry.colorSchemes,
        kind: "component",
        propSchema: entry.propSchema,
        slots: entry.slots,
        controls: entry.controls,
        ownedDependencies: [],
      };
  }
}

export function viewerCatalogue(model: ShellCatalogueReadModel) {
  const current = [
    ...model.screens,
    ...model.pages,
    ...model.documents,
    ...model.useCases,
    ...model.components,
  ];
  const manifest = {
    schemaVersion: "live-index-2" as const,
    generatedBy: "mokly" as const,
    folders: [],
    sourceFiles: [],
    entries: current.map((entry) => ({
      ...displayEntry(entry),
      declaredDependencies: entry.details.dependencies,
    })),
  };
  const catalogue = createCatalogue(
    manifest,
    model.removedEntries.map(
      ({ entry, snapshotId, folderTitles, parentTitle }) => ({
        folderTitles,
        entry: displayEntry(entry),
        ...(snapshotId ? { snapshotId } : {}),
        ...(parentTitle !== undefined ? { parentTitle } : {}),
      }),
    ),
    current.flatMap(({ path, previousPath }) =>
      previousPath === undefined ? [] : [{ path, previousPath }],
    ),
  );
  return {
    ...catalogue,
    hierarchy: adoptCatalogueTree(
      catalogue.hierarchy,
      model.tree,
      model.treeOrder,
    ),
    publicModel: model,
  };
}

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
    base: "",
    embedded: true,
    updateVersion: model.revision.evidence,
    comparisons: model.comparisonUrl !== null,
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
  catalogue: ReturnType<typeof viewerCatalogue>,
  selection: ViewerSelection,
): ShellView {
  if (selection.screenPath === null) return { kind: "home" };
  const selected = catalogue.publicModel
    ? resolveCatalogueSelection(
        catalogue.publicModel,
        selection.screenPath,
        selection.snapshotId,
      )
    : undefined;
  const entry = catalogue.publicModel
    ? selected
      ? catalogueRouteEntry(catalogue, selected.entry.path, selected.entry.kind)
      : undefined
    : selection.snapshotId === undefined
      ? catalogue.byPath.get(selection.screenPath)
      : undefined;
  const target = entry && toRouteTarget(entry);
  return target
    ? { kind: "target", target }
    : { kind: "missing", requested: selection.screenPath };
}

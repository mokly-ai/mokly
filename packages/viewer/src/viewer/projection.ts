/** Convert validated public data to the existing shell's display records. */
import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import type {
  CatalogueReadModel,
  CatalogueRoutedEntry,
  CatalogueView,
} from "../catalogue/types.js";
import type {
  ComponentViewRecord,
  ManifestComponentVariant,
} from "../components/manifest_types.js";
import { componentFragmentRoute } from "../components/paths.js";
import type { ManifestEntry, ManifestV6 } from "../registry/types.js";
import { catalogueRouteEntry, createCatalogue } from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { toRouteTarget } from "../shell/target.js";
import type { ShellView } from "../shell/views.js";

import type { ViewerSelection } from "./types.js";

function metadata(entry: CatalogueRoutedEntry) {
  return {
    id: entry.id,
    title: entry.title,
    tags: entry.tags,
    ...entry.details,
    declaredDependencies: entry.details.dependencies,
    navPath: entry.navPath,
  };
}
export function usageView(
  view: CatalogueView,
): ComponentViewRecord | undefined {
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
function fragments(
  views: readonly CatalogueView[],
  fallback: (axis: "mobile" | "desktop", scheme: "light" | "dark") => string,
) {
  const paths = (scheme: "light" | "dark") =>
    Object.fromEntries(
      ["mobile", "desktop"].map((axis) => [
        axis,
        views
          .find((v) => v.viewport === axis && v.colorScheme === scheme)
          ?.fragmentPath?.slice(7) ??
          fallback(axis as "mobile" | "desktop", scheme),
      ]),
    ) as Record<"mobile" | "desktop", string>;
  return {
    fragments: paths("light"),
    ...(views.some((v) => v.colorScheme === "dark")
      ? { darkFragments: paths("dark") }
      : {}),
    componentViews: views.flatMap((view) => usageView(view) ?? []),
  };
}
export function displayEntry(entry: CatalogueRoutedEntry): ManifestEntry {
  const base = { ...metadata(entry), route: entry.route };
  switch (entry.kind) {
    case "page":
      return { ...base, kind: "page" };
    case "use-case":
      return { ...base, kind: "use-case", steps: entry.steps };
    case "screen":
      return {
        ...base,
        kind: "screen",
        viewports: entry.viewports,
        useCaseIds: entry.useCaseIds,
        ...(entry.address ? { address: entry.address } : {}),
        ...(entry.variantOf !== undefined
          ? { variantOf: entry.variantOf }
          : {}),
        ...fragments(entry.views, (axis, scheme) =>
          entry.route.replace(
            /\.html$/,
            `.${axis}${scheme === "dark" ? ".dark" : ""}.html`,
          ),
        ),
      };
    case "component":
      return {
        ...base,
        kind: "component",
        viewports: ["mobile", "desktop"],
        propSchema: entry.propSchema,
        slots: entry.slots,
        controls: entry.controls,
        ownedDependencies: [],
        variants: entry.variants.map((variant): ManifestComponentVariant => ({
          id: variant.id,
          title: variant.title,
          ...(variant.description !== undefined
            ? { description: variant.description }
            : {}),
          props: variant.props,
          suppliedSlots: variant.suppliedSlots,
          ...fragments(variant.views, (axis, scheme) =>
            componentFragmentRoute(entry.route, variant.id, axis, scheme),
          ),
        })),
      };
  }
}
export function viewerCatalogue(model: CatalogueReadModel) {
  const manifest: ManifestV6 = {
    schemaVersion: 6,
    generatedBy: "mokly",
    sourceFiles: [],
    entries: [
      ...[
        ...model.screens,
        ...model.pages,
        ...model.useCases,
        ...model.components,
      ].map((entry) => ({
        ...displayEntry(entry),
        declaredDependencies: entry.details.dependencies,
      })),
    ],
  };
  return {
    ...createCatalogue(
      manifest,
      model.removedEntries.map(({ entry, snapshotId }) => ({
        entry: displayEntry(entry),
        ...(snapshotId ? { snapshotId } : {}),
      })),
    ),
    publicModel: model,
  };
}
export function viewerContext(
  model: CatalogueReadModel,
  selection: ViewerSelection,
): ShellContext {
  const resolved =
    typeof selection.screenId === "string"
      ? resolveCatalogueSelection(
          model,
          selection.screenId,
          selection.snapshotId,
        )
      : undefined;
  const selected = resolved?.entry;
  return {
    base: "",
    embedded: true,
    updateVersion: model.revision.evidence,
    comparisons: model.comparisonUrl !== null,
    ...(model.changesStatus === "disabled"
      ? {}
      : { changesStatus: model.changesStatus }),
    ...(selected ? { activeRoute: selected.route } : {}),
    ...(resolved?.snapshotId ? { snapshotId: resolved.snapshotId } : {}),
    ...(model.changesStatus === "ready"
      ? {
          changedRoutes: [
            ...model.screens,
            ...model.pages,
            ...model.useCases,
            ...model.components,
            ...model.removedEntries.map(({ entry }) => entry),
          ]
            .filter(
              (entry) =>
                entry.changes.status === "ready" && entry.changes.included,
            )
            .map((entry) => entry.route),
        }
      : {}),
  };
}
export function viewerView(
  catalogue: ReturnType<typeof viewerCatalogue>,
  selection: ViewerSelection,
): ShellView {
  if (selection.screenId === null) return { kind: "home" };
  const selected = catalogue.publicModel
    ? resolveCatalogueSelection(
        catalogue.publicModel,
        selection.screenId,
        selection.snapshotId,
      )
    : undefined;
  const entry = catalogue.publicModel
    ? selected
      ? catalogueRouteEntry(catalogue, selected.entry.route)
      : undefined
    : selection.snapshotId === undefined
      ? catalogue.byId.get(selection.screenId)
      : undefined;
  const target = entry && toRouteTarget(entry);
  return target
    ? { kind: "target", target }
    : { kind: "missing", requested: selection.screenId };
}

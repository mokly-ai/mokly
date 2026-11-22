/** Merge the held entry details into the index as the shell's working model. */

import type {
  CatalogueComponent,
  CataloguePage,
  CatalogueReadModel,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueView,
  EntryDetailV4,
  RemovedEntry,
  ViewEvidence,
} from "@mokly/model";

import { detailKey } from "./detail_fences.js";
import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueUsage,
  ShellCatalogueView,
} from "./scoped_types.js";

const OMITTED: ShellCatalogueUsage = { status: "omitted" };
type DetailViews = EntryDetailV4["views"];
const projectScreen = memoizeProjection(projectVisual<CatalogueScreen>);
const projectComponent = memoizeProjection(projectVisual<CatalogueComponent>);
const projectPage = memoizeProjection(
  (entry: CataloguePage, evidence: ViewEvidence | undefined) =>
    evidence ? { ...entry, resourceEvidence: evidence } : entry,
);
const projectRemoved = memoizeProjection(
  (record: RemovedEntry, entry: ShellCatalogueRoutedEntry) => ({
    ...record,
    entry,
  }),
);

/** Held details by `detailKey`; each one already passed its fence. */
export type HeldDetails = ReadonlyMap<string, EntryDetailV4>;

/** Every view without a held detail carries `omitted` usage. */
export function shellCatalogueModel(
  index: CatalogueReadModel,
  details: HeldDetails,
): ShellCatalogueReadModel {
  const current = (entry: CatalogueRecord) =>
    details.get(detailKey({ path: entry.path }));
  return {
    ...index,
    details,
    screens: index.screens.map((screen) =>
      projectScreen(screen, current(screen)?.views),
    ),
    components: index.components.map((component) =>
      projectComponent(component, current(component)?.views),
    ),
    pages: index.pages.map((page) =>
      projectPage(page, current(page)?.resourceEvidence),
    ),
    removedEntries: index.removedEntries.map((record) => {
      const detail =
        record.snapshotId === undefined
          ? undefined
          : details.get(
              detailKey({
                path: record.entry.path,
                snapshotId: record.snapshotId,
              }),
            );
      return projectRemoved(record, projectEntry(record.entry, detail));
    }),
  };
}

function projectEntry(
  entry: CatalogueRecord,
  detail: EntryDetailV4 | undefined,
): ShellCatalogueRoutedEntry {
  if (entry.kind === "screen") return projectScreen(entry, detail?.views);
  if (entry.kind === "component") return projectComponent(entry, detail?.views);
  if (entry.kind === "page")
    return projectPage(entry, detail?.resourceEvidence);
  return entry;
}

function projectVisual<T extends CatalogueScreen | CatalogueComponent>(
  entry: T,
  heldViews: DetailViews | undefined,
): Omit<T, "views"> & { views: ShellCatalogueView[] } {
  return {
    ...entry,
    views: entry.views.map((view) => projectView(view, heldViews)),
  };
}

function projectView(
  view: CatalogueView,
  heldViews: DetailViews | undefined,
): ShellCatalogueView {
  const held = heldViews?.find(
    (candidate) =>
      candidate.viewport === view.viewport &&
      candidate.colorScheme === view.colorScheme,
  );
  if (!held) return { ...view, usage: OMITTED };
  return {
    ...view,
    usage: held.usage,
    ...(held.state ? { state: held.state } : {}),
    ...(held.ignoredIds ? { ignoredIds: held.ignoredIds } : {}),
    ...(held.resourceEvidence
      ? { resourceEvidence: held.resourceEvidence }
      : {}),
  };
}

/** Memoize on the raw record and only the projected part of its detail. */
function memoizeProjection<T extends object, D, R>(
  project: (record: T, detail: D) => R,
): (record: T, detail: D) => R {
  const projections = new WeakMap<T, { detail: D; result: R }>();
  return (record, detail) => {
    const held = projections.get(record);
    if (held && held.detail === detail) return held.result;
    const result = project(record, detail);
    projections.set(record, { detail, result });
    return result;
  };
}

/** Merge the held entry details into the index as the shell's working model. */

import { detailKey } from "./detail_fences.js";
import type {
  ShellCatalogueComponent,
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueScreen,
  ShellCatalogueUsage,
  ShellCatalogueView,
} from "./scoped_types.js";
import type {
  CatalogueComponent,
  CatalogueReadModel,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueView,
  EntryDetailV4,
} from "./types.js";

const OMITTED: ShellCatalogueUsage = { status: "omitted" };

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
      projectVisual(screen, current(screen)),
    ),
    components: index.components.map((component) =>
      projectVisual(component, current(component)),
    ),
    pages: index.pages.map((page) => {
      const evidence = current(page)?.resourceEvidence;
      return evidence ? { ...page, resourceEvidence: evidence } : page;
    }),
    removedEntries: index.removedEntries.map((record) => ({
      ...record,
      entry: projectEntry(
        record.entry,
        record.snapshotId === undefined
          ? undefined
          : details.get(
              detailKey({
                path: record.entry.path,
                snapshotId: record.snapshotId,
              }),
            ),
      ),
    })),
  };
}

function projectEntry(
  entry: CatalogueRecord,
  detail: EntryDetailV4 | undefined,
): ShellCatalogueRoutedEntry {
  if (entry.kind === "screen" || entry.kind === "component")
    return projectVisual(entry, detail);
  if (entry.kind === "page" && detail?.resourceEvidence)
    return { ...entry, resourceEvidence: detail.resourceEvidence };
  return entry;
}

function projectVisual(
  entry: CatalogueScreen,
  detail: EntryDetailV4 | undefined,
): ShellCatalogueScreen;
function projectVisual(
  entry: CatalogueComponent,
  detail: EntryDetailV4 | undefined,
): ShellCatalogueComponent;
function projectVisual(
  entry: CatalogueScreen | CatalogueComponent,
  detail: EntryDetailV4 | undefined,
): ShellCatalogueScreen | ShellCatalogueComponent;
function projectVisual(
  entry: CatalogueScreen | CatalogueComponent,
  detail: EntryDetailV4 | undefined,
): ShellCatalogueScreen | ShellCatalogueComponent {
  return {
    ...entry,
    views: entry.views.map((view) => projectView(view, detail)),
  };
}

function projectView(
  view: CatalogueView,
  detail: EntryDetailV4 | undefined,
): ShellCatalogueView {
  const held = detail?.views.find(
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

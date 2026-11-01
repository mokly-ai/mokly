/** The home page's count of the catalogue's current entries. */

import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
} from "../catalogue/scoped_types.js";

type EntryKind = ShellCatalogueRoutedEntry["kind"];

/**
 * Each entry kind's label, singular then plural, in the order the summary
 * lists them. A kind missing here fails to compile, so a new kind is counted.
 */
const LABELS = {
  screen: ["screen", "screens"],
  component: ["component", "components"],
  "use-case": ["user flow", "user flows"],
  page: ["catalogue page", "catalogue pages"],
  document: ["document", "documents"],
} as const satisfies Record<EntryKind, readonly [string, string]>;

/**
 * Count the current entries of every kind, variant records included, and
 * omit kinds with none. A catalogue with no entries has no summary.
 */
export function homeSummary(
  model: ShellCatalogueReadModel,
): string | undefined {
  const counts = {
    screen: model.screens.length,
    component: model.components.length,
    "use-case": model.useCases.length,
    page: model.pages.length,
    document: model.documents.length,
  } satisfies Record<EntryKind, number>;
  const parts = (Object.keys(LABELS) as EntryKind[]).flatMap((kind) => {
    const count = counts[kind];
    const [one, many] = LABELS[kind];
    return count === 0 ? [] : [`${count} ${count === 1 ? one : many}`];
  });
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

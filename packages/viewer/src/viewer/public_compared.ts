/** The routed entry's comparison facts from its index record and its held detail. */

import type {
  ShellCatalogueComponent,
  ShellCatalogueScreen,
} from "../catalogue/scoped_types.js";
import type { EntryDetailV4 } from "../catalogue/types.js";
import type { ComparedEntry, ReviewView } from "../review/types.js";

/**
 * The compared entry once its detail carries ready views: the views' review
 * states, ignore ids, and evidence, the direct reasons, the base side's path,
 * and a component's saved props on both sides. `undefined` while no view of
 * the entry is ready.
 */
export function publicComparedEntry(
  entry: ShellCatalogueScreen | ShellCatalogueComponent,
  detail: EntryDetailV4 | undefined,
): ComparedEntry | undefined {
  const views = entry.views.flatMap((view): ReviewView[] =>
    view.state && view.ignoredIds && view.resourceEvidence
      ? [
          {
            viewport: view.viewport,
            colorScheme: view.colorScheme,
            state: view.state,
            ignoredIds: view.ignoredIds,
            rules: view.resourceEvidence.rules,
            resources: view.resourceEvidence.resources,
          },
        ]
      : [],
  );
  if (!views.length) return undefined;
  const before = detail?.before;
  return {
    path: entry.path,
    basePath: before?.path ?? entry.path,
    reasons: detail?.reasons ?? [],
    views,
    ...(entry.kind === "component" && before?.props
      ? { savedProps: { before: before.props, after: entry.props } }
      : {}),
  };
}

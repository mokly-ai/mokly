import {
  isManifestComponentVariant,
  isStylesheetPath,
} from "@mokly/viewer/data";
import type { DependencyReason } from "@mokly/viewer/data";

import type { entryPairs } from "./component_metadata.js";
import { entryViewPairs } from "./component_pairing.js";
import type { componentVariantEntries } from "./component_variant_classification.js";
import { compareComponentView } from "./component_view.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view_types.js";
import type { EntryMove } from "./moves/types.js";

/** Collect complete-catalogue own-page proof before assigning any CSS page reason. */
export async function classificationComparisons(
  context: ComponentViewContext,
  pairs: ReturnType<typeof entryPairs>,
  before: ReturnType<typeof componentVariantEntries>,
  after: ReturnType<typeof componentVariantEntries>,
  moves: readonly EntryMove[],
) {
  const entries = [];
  for (const pair of pairs) {
    const entry = (pair.after ?? pair.before)!;
    const parent = [pair.after, pair.before].find(
      (candidate) =>
        candidate?.kind === "component" &&
        !isManifestComponentVariant(candidate),
    );
    if (entry.kind === "component" && !parent) continue;
    const root = parent?.path;
    const grouped = entryViewPairs(pair, before, after, moves);
    const pairedViews = grouped.views;
    const compared = await Promise.all(
      pairedViews.map((view) =>
        compareComponentView(context, view.before, view.after, root),
      ),
    );
    entries.push({ pair, pairedViews, compared, root, grouped });
  }
  const attribution = context.resources.css.attribution;
  attribution.freeze();
  for (const entry of entries)
    for (const comparison of entry.compared)
      finalizeCss(comparison, context, entry.root);
  return entries;
}

function finalizeCss(
  comparison: ComparedComponentView,
  context: ComponentViewContext,
  root?: string,
): void {
  const attribution = context.resources.css.attribution;
  const actual = comparison.view.reasons ?? [];
  const css = actual.filter((reason) => isStylesheetPath(reason.path));
  const project = (mode: "view" | "page" | "component") =>
    css.flatMap((reason) => {
      const projected = attribution.project(reason, mode, root);
      return projected ? [projected] : [];
    });
  const viewReasons: DependencyReason[] = [
    ...actual.filter((reason) => !isStylesheetPath(reason.path)),
    ...project("view"),
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  comparison.view = {
    ...comparison.view,
    ...(viewReasons.length ? { reasons: viewReasons } : {}),
  };
  comparison.reasons = [
    ...comparison.reasons.filter(
      (reason) =>
        reason.kind !== "dependency" || !isStylesheetPath(reason.path),
    ),
    ...project("page"),
  ];
  if (root) comparison.componentCssReasons = project("component");
}

/** Identical original bytes need neither projection nor inline CSS analysis. */
import type { ViewReview } from "@mokly/viewer/data";

import { componentUsageSignals } from "../components/comparison_material.js";

import { changedResourceBytes } from "./component_resource_changes.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view.js";
import type { PageAnalysisPair } from "./page_pair.js";
import { styleNeedsFullValidation } from "./style_source_safety.js";

export async function identicalPageQuickCheck(
  context: ComponentViewContext,
  pages: PageAnalysisPair,
  view: ViewReview,
): Promise<ComparedComponentView | undefined> {
  const head = pages.afterAnalysis;
  const paired = pages.pairedIgnoreIds;
  const styles = head.inlineStyles(paired);
  if (
    styles.some(styleNeedsFullValidation) ||
    head.hasDroppedStyleReferences(paired)
  )
    return;
  if (!(await unchangedPageResources(context, pages))) {
    if (
      context.useMaterialFingerprints !== false &&
      context.useFastPath !== false &&
      context.useStylePath !== false
    )
      pages.rememberStyleSafety(styles);
    return;
  }
  const signals = componentUsageSignals(pages.before.usage, pages.after.usage);
  return {
    comparisonPath: "fast",
    view: { ...view, state: "unchanged", ignoredIds: [] },
    reasons: [
      ...(signals.inputs ? [{ kind: "inputs" as const }] : []),
      ...(signals.structure ? [{ kind: "structure" as const }] : []),
    ],
    changedImplementations: new Set(),
    ownedResources: [],
  };
}

/** Conservative shared-seed proof over both snapshots' closures and bytes. */
export async function unchangedPageResources(
  context: ComponentViewContext,
  pages: PageAnalysisPair,
  requiredReferences?: Iterable<string>,
): Promise<boolean> {
  const head = pages.afterAnalysis;
  const seeds = head.conservativeReferences(pages.pairedIgnoreIds);
  if (requiredReferences) {
    const covered = new Set(seeds);
    for (const reference of requiredReferences)
      if (!covered.has(reference)) return false;
  }
  const afterResources = await context.afterReader.resources(
    head.route,
    head.source,
    undefined,
    { references: seeds },
  );
  const beforeResources = await context.beforeReader.resourcesIfPresent(
    head.route,
    head.source,
    undefined,
    { references: seeds },
  );
  if (!beforeResources) return false;
  const path = (route: string) =>
    context.prefix ? `${context.prefix}/${route}` : route;
  if (
    [...beforeResources, ...afterResources].some((route) =>
      context.changed.has(path(route)),
    )
  )
    return false;
  if (
    (
      await changedResourceBytes(
        beforeResources,
        afterResources,
        context.beforeReader,
        context.afterReader,
      )
    ).size
  )
    return false;
  return true;
}

/** Identical original bytes need neither projection nor inline CSS analysis. */
import type { ViewReview } from "@mokly/viewer/data";

import { componentUsageSignals } from "../components/comparison_material.js";

import { referenceRoutes } from "./asset_references.js";
import { changedResourceBytes } from "./component_resource_changes.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view.js";
import type { PageAnalysisPair } from "./page_pair.js";

export async function identicalPageQuickCheck(
  context: ComponentViewContext,
  pages: PageAnalysisPair,
  view: ViewReview,
): Promise<ComparedComponentView | undefined> {
  if (pages.afterAnalysis.hasDroppedStyleReferences(pages.pairedIgnoreIds))
    return;
  if (!(await unchangedPageResources(context, pages))) return;
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

/** Conservative shared-seed proof: head closure in committed mode, both in derived mode. */
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
    seeds,
  );
  if (context.compareResourceBytes)
    for (const route of referenceRoutes(head.route, seeds))
      if ((await context.beforeReader.readIfExists(route)) === undefined)
        return false;
  const beforeResources = context.compareResourceBytes
    ? await context.beforeReader.resources(
        head.route,
        head.source,
        undefined,
        seeds,
      )
    : afterResources;
  const path = (route: string) =>
    context.prefix ? `${context.prefix}/${route}` : route;
  if (
    [...beforeResources, ...afterResources].some((route) =>
      context.changed.has(path(route)),
    )
  )
    return false;
  if (
    context.compareResourceBytes &&
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

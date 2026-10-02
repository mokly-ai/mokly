/** Identical original bytes need neither projection nor inline CSS analysis. */
import type { ViewReview } from "@mokly/viewer/data";

import { componentUsageSignals } from "../components/comparison_material.js";

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
  const head = pages.afterAnalysis;
  const seeds = head.conservativeReferences(pages.pairedIgnoreIds);
  const afterResources = await context.afterReader.resources(
    head.route,
    head.source,
    undefined,
    seeds,
  );
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
    return;
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
    return;
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

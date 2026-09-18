import type { GeneratedComponentView, ViewReview } from "@mokly/viewer/data";

import {
  componentUsageSignals,
  componentUsageTopologyEqual,
  stripComponentMarkers,
  stripHistoricalMarkers,
} from "../components/comparison_material.js";

import { mayProjectCallerSlotFromTemplate } from "./component_fast_path_eligibility.js";
import { changedResourceBytes } from "./component_resource_changes.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view.js";
import {
  normalizeHistoricalDocument,
  normalizeReviewPair,
  normalizeSingleDocument,
} from "./ignore.js";

/** Settle a paired view when neither its documents nor reachable resources can differ. */
export async function compareUnchangedComponentView(
  context: ComponentViewContext,
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  view: ViewReview,
  base: string,
  head: string,
): Promise<ComparedComponentView | undefined> {
  if (before.path !== after.path) return undefined;
  const retained = normalizeReviewPair(
    normalizeHistoricalDocument(base),
    head,
    after.path,
  );
  if (retained.base !== retained.head) return undefined;
  if (!componentUsageTopologyEqual(before.usage, after.usage)) return undefined;
  if (
    mayProjectCallerSlotFromTemplate(retained.base, before.usage) ||
    mayProjectCallerSlotFromTemplate(retained.head, after.usage)
  )
    return undefined;

  const strippedBase = stripHistoricalMarkers(base);
  const strippedHead = stripComponentMarkers(head);
  const actual = normalizeReviewPair(strippedBase, strippedHead, after.path);
  if (actual.base !== actual.head) return undefined;

  const afterResources = await context.afterReader.resources(
    after.path,
    actual.head,
  );
  const beforeResources = context.compareResourceBytes
    ? await context.beforeReader.resources(before.path, actual.base)
    : afterResources;
  const resources = new Set([...beforeResources, ...afterResources]);
  const repoPath = (route: string) =>
    context.prefix ? `${context.prefix}/${route}` : route;
  if ([...resources].some((route) => context.changed.has(repoPath(route))))
    return undefined;
  if (
    context.compareResourceBytes &&
    (
      await changedResourceBytes(
        beforeResources,
        afterResources,
        context.beforeReader,
        context.afterReader,
      )
    ).size > 0
  )
    return undefined;

  const signals = componentUsageSignals(before.usage, after.usage);
  const reasons = [
    ...(signals.inputs ? [{ kind: "inputs" as const }] : []),
    ...(signals.structure ? [{ kind: "structure" as const }] : []),
  ];
  const rawEqual =
    normalizeSingleDocument(strippedBase, after.path) ===
    normalizeSingleDocument(strippedHead, after.path);
  return {
    comparisonPath: "fast",
    view: {
      ...view,
      ignoredIds: actual.ignoredIds,
      state: rawEqual ? "unchanged" : "ignored-only",
    },
    reasons,
    changedImplementations: new Set(),
    ownedResources: [],
  };
}

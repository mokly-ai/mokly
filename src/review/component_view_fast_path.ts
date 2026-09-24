import type { GeneratedComponentView, ViewReview } from "@mokly/viewer/data";

import {
  componentUsageSignals,
  componentUsageTopologyEqual,
  stripComponentMarkers,
  stripHistoricalMarkers,
} from "../components/comparison_material.js";

import {
  prepareComponentProjection,
  type PreparedComponentComparison,
} from "./component_projection_resources.js";
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
import { normalizeDocumentUrls } from "./normalize_urls.js";

export interface UnchangedComponentAttempt {
  comparison?: ComparedComponentView;
  prepared?: PreparedComponentComparison;
}

/** Settle a paired view when neither its documents nor reachable resources can differ. */
export async function compareUnchangedComponentView(
  context: ComponentViewContext,
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  view: ViewReview,
  base: string,
  head: string,
  root?: string,
): Promise<UnchangedComponentAttempt> {
  if (before.path !== after.path) return {};
  const retained = normalizeReviewPair(
    normalizeHistoricalDocument(base),
    head,
    after.path,
    {
      before: context.beforeReader.generated.prefix,
      after: context.afterReader.generated.prefix,
      beforeRoutes: context.beforeReader.generated.routes,
      afterRoutes: context.afterReader.generated.routes,
    },
  );
  if (
    (retained.comparisonBase ?? retained.base) !==
    (retained.comparisonHead ?? retained.head)
  )
    return {};
  if (!componentUsageTopologyEqual(before.usage, after.usage)) return {};

  const strippedBase = stripHistoricalMarkers(base);
  const strippedHead = stripComponentMarkers(head);
  const actual = normalizeReviewPair(strippedBase, strippedHead, after.path, {
    before: context.beforeReader.generated.prefix,
    after: context.afterReader.generated.prefix,
    beforeRoutes: context.beforeReader.generated.routes,
    afterRoutes: context.afterReader.generated.routes,
  });
  if (
    (actual.comparisonBase ?? actual.base) !==
    (actual.comparisonHead ?? actual.head)
  )
    return {};

  const hasOwnershipEdits = [before.usage, after.usage].some(
    (usage) =>
      usage &&
      (usage.instances.length > 0 ||
        usage.styles.length > 0 ||
        usage.slots.some((slot) => slot.owner.kind === "entry")),
  );
  const prepared = hasOwnershipEdits
    ? prepareComponentProjection(context, before, after, base, head, root)
    : undefined;
  const projected = prepared?.projected;
  const excluded = prepared?.excluded;
  const fallback = (): UnchangedComponentAttempt =>
    prepared ? { prepared } : {};
  if (
    projected &&
    normalizeDocumentUrls(
      projected.before,
      before.path,
      context.beforeReader.generated.prefix,
      context.beforeReader.generated.routes,
    ) !==
      normalizeDocumentUrls(
        projected.after,
        after.path,
        context.afterReader.generated.prefix,
        context.afterReader.generated.routes,
      )
  )
    return fallback();

  const afterResources = await context.afterReader.resources(
    after.path,
    actual.head,
  );
  const beforeResources = context.compareResourceBytes
    ? await context.beforeReader.resources(before.path, actual.base)
    : afterResources;
  const projectedAfterResources =
    projected && excluded
      ? await context.afterReader.resources(
          after.path,
          projected.after,
          excluded,
        )
      : new Set<string>();
  const projectedBeforeResources =
    projected && excluded && context.compareResourceBytes
      ? await context.beforeReader.resources(
          before.path,
          projected.before,
          excluded,
        )
      : projectedAfterResources;
  const resources = new Set([
    ...beforeResources,
    ...afterResources,
    ...projectedBeforeResources,
    ...projectedAfterResources,
  ]);
  const repoPath = (route: string) =>
    context.prefix ? `${context.prefix}/${route}` : route;
  if ([...resources].some((route) => context.changed.has(repoPath(route))))
    return fallback();
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
    return fallback();
  if (
    context.compareResourceBytes &&
    (
      await changedResourceBytes(
        projectedBeforeResources,
        projectedAfterResources,
        context.beforeReader,
        context.afterReader,
      )
    ).size > 0
  )
    return fallback();

  const signals = componentUsageSignals(before.usage, after.usage);
  const reasons = [
    ...(signals.inputs ? [{ kind: "inputs" as const }] : []),
    ...(signals.structure ? [{ kind: "structure" as const }] : []),
  ];
  const rawEqual =
    normalizeDocumentUrls(
      normalizeSingleDocument(strippedBase, after.path),
      before.path,
      context.beforeReader.generated.prefix,
      context.beforeReader.generated.routes,
    ) ===
    normalizeDocumentUrls(
      normalizeSingleDocument(strippedHead, after.path),
      after.path,
      context.afterReader.generated.prefix,
      context.afterReader.generated.routes,
    );
  return {
    ...(prepared ? { prepared } : {}),
    comparison: {
      comparisonPath: "fast",
      view: {
        ...view,
        ignoredIds: actual.ignoredIds,
        state: rawEqual ? "unchanged" : "ignored-only",
      },
      reasons,
      changedImplementations: new Set(),
      ownedResources: [],
    },
  };
}

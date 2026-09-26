import type { GeneratedComponentView, ViewReview } from "@mokly/viewer/data";

import {
  componentUsageSignals,
  componentUsageTopologyEqual,
  stripComponentMarkers,
  stripHistoricalMarkers,
} from "../components/comparison_material.js";
import { comparisonStylesheetMaterial } from "../components/comparison_stylesheets.js";

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
  const baseMaterial = comparisonStylesheetMaterial(base, before.usage, root);
  const headMaterial = comparisonStylesheetMaterial(head, after.usage, root);
  const retained = normalizeReviewPair(
    normalizeHistoricalDocument(baseMaterial.html),
    headMaterial.html,
    after.path,
  );
  if (retained.base !== retained.head) return {};
  if (!componentUsageTopologyEqual(before.usage, after.usage)) return {};

  const strippedBase = stripHistoricalMarkers(baseMaterial.html);
  const strippedHead = stripComponentMarkers(headMaterial.html);
  const actual = normalizeReviewPair(strippedBase, strippedHead, after.path);
  if (actual.base !== actual.head) return {};

  const hasOwnershipEdits = [before.usage, after.usage].some(
    (usage) =>
      usage &&
      (usage.instances.length > 0 ||
        usage.styles.length > 0 ||
        usage.slots.some((slot) => slot.owner.kind === "entry")),
  );
  const prepared = hasOwnershipEdits
    ? prepareComponentProjection(before, after, base, head, root)
    : undefined;
  const projected = prepared?.projected;
  const excluded = prepared?.excluded;
  const fallback = (): UnchangedComponentAttempt =>
    prepared ? { prepared } : {};
  if (projected && projected.before !== projected.after) return fallback();

  const actualResource = normalizeReviewPair(
    stripHistoricalMarkers(base),
    stripComponentMarkers(head),
    after.path,
  );
  const afterResources = await context.afterReader.resources(
    after.path,
    actualResource.head,
  );
  const beforeResources = context.compareResourceBytes
    ? await context.beforeReader.resources(before.path, actualResource.base)
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
    normalizeSingleDocument(strippedBase, after.path) ===
    normalizeSingleDocument(strippedHead, after.path);
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

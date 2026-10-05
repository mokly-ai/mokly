import type { GeneratedComponentView, ViewReview } from "@mokly/viewer/data";

import {
  componentUsageSignals,
  componentUsageTopologyEqual,
  stripComponentMarkers,
} from "../components/comparison_material.js";
import { comparisonStylesheetMaterial } from "../components/comparison_stylesheets.js";

import {
  prepareComponentProjection,
  type PreparedComponentComparison,
} from "./component_projection_resources.js";
import { changedResourceBytes } from "./component_resource_changes.js";
import { insertedStylesheetResources } from "./component_stylesheet_resources.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view_types.js";
import { normalizeReviewPair, normalizeSingleDocument } from "./ignore.js";

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
  const links = context.links?.(before.path, after.path);
  const baseMaterial = comparisonStylesheetMaterial(base, before.usage, root);
  const headMaterial = comparisonStylesheetMaterial(head, after.usage, root);
  const retained = normalizeReviewPair(
    baseMaterial.html,
    headMaterial.html,
    after.path,
    links,
  );
  if (retained.base !== retained.head) return {};
  if (!componentUsageTopologyEqual(before.usage, after.usage)) return {};

  const strippedBase = stripComponentMarkers(baseMaterial.html);
  const strippedHead = stripComponentMarkers(headMaterial.html);
  const actual = normalizeReviewPair(
    strippedBase,
    strippedHead,
    after.path,
    links,
  );
  if (actual.base !== actual.head) return {};

  const hasOwnershipEdits = [before.usage, after.usage].some(
    (usage) =>
      usage &&
      (usage.instances.length > 0 ||
        usage.ranges.some((range) => range.target.kind === "root") ||
        usage.styles.length > 0 ||
        usage.slots.some((slot) => slot.owner.kind === "entry")),
  );
  const prepared = hasOwnershipEdits
    ? prepareComponentProjection(before, after, base, head, root, links)
    : undefined;
  const projected = prepared?.projected;
  const excluded = prepared?.excluded;
  const fallback = (): UnchangedComponentAttempt =>
    prepared ? { prepared } : {};
  if (projected && projected.before !== projected.after) return fallback();

  const actualResource = normalizeReviewPair(
    stripComponentMarkers(base),
    stripComponentMarkers(head),
    after.path,
    links,
  );
  const afterResources = await context.afterReader.resources(
    after.path,
    actualResource.resourceHead ?? actualResource.head,
    undefined,
    insertedStylesheetResources(head, after.usage, after.path),
  );
  const beforeResources = context.compareResourceBytes
    ? await context.beforeReader.resources(
        before.path,
        actualResource.resourceBase ?? actualResource.base,
        undefined,
        insertedStylesheetResources(base, before.usage, before.path),
      )
    : afterResources;
  const projectedAfterResources =
    projected && excluded
      ? await context.afterReader.resources(
          after.path,
          projected.resourceAfter ?? projected.after,
          excluded,
        )
      : new Set<string>();
  const projectedBeforeResources =
    projected && excluded && context.compareResourceBytes
      ? await context.beforeReader.resources(
          before.path,
          projected.resourceBefore ?? projected.before,
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
        context.resourceIdentity,
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
        context.resourceIdentity,
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
    normalizeSingleDocument(strippedBase, after.path, links?.before) ===
    normalizeSingleDocument(strippedHead, after.path, links?.after);
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

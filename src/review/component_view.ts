import type {
  GeneratedComponentView,
  EntryChangeReason,
  ViewReview,
} from "@mokly/viewer/data";
import { isStylesheetPath } from "@mokly/viewer/data";

import { stripMarkers } from "../components/comparison_material.js";
import { changedComponentImplementations } from "../components/comparison_projection.js";
import { MoklyError } from "../errors.js";

import {
  prepareComponentProjection,
  componentPageMaterial,
  normalizeOneSidedView,
  type PreparedComponentComparison,
} from "./component_projection_resources.js";
import {
  ownedResourceReasons,
  rootResourcesChanged,
} from "./component_resource_attribution.js";
import { changedResourceBytes } from "./component_resource_changes.js";
import { insertedStylesheetResources } from "./component_stylesheet_resources.js";
import { compareUnchangedComponentView } from "./component_view_fast_path.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view_types.js";
import { componentCssDocuments } from "./css/containment.js";
import { normalizeReviewPair } from "./ignore.js";

/** Compare material and declared inputs without altering the retained view documents. */
export async function compareComponentView(
  context: ComponentViewContext,
  before: GeneratedComponentView | undefined,
  after: GeneratedComponentView | undefined,
  root?: string,
): Promise<ComparedComponentView> {
  if (before?.usage && context.beforeUsage)
    before = { ...before, usage: context.beforeUsage(before.usage) };
  const selected = after ?? before;
  if (!selected)
    throw new MoklyError(
      "review-invalid",
      "Comparison view requires at least one side",
    );
  const base = before
    ? await context.beforeReader.text(before.path)
    : undefined;
  const head = after ? await context.afterReader.text(after.path) : undefined;
  const baseStylesheets = insertedStylesheetResources(
    base,
    before?.usage,
    selected.path,
  );
  const headStylesheets = insertedStylesheetResources(
    head,
    after?.usage,
    selected.path,
  );
  const view: ViewReview = {
    viewport: selected.viewport,
    colorScheme: selected.colorScheme,
    ignoredIds: [],
    state: before ? "removed" : "added",
  };
  if (base === undefined || head === undefined) {
    const normalized =
      base !== undefined
        ? normalizeOneSidedView(base, before!, root)
        : normalizeOneSidedView(head!, after!, root);
    const evidence = await context.resources.compare(
      before
        ? {
            path: before.path,
            html: normalized.resource,
            insertedStylesheets: baseStylesheets,
          }
        : undefined,
      after
        ? {
            path: after.path,
            html: normalized.resource,
            insertedStylesheets: headStylesheets,
          }
        : undefined,
      undefined,
      undefined,
      () => [
        componentCssDocuments(
          base,
          head,
          selected.path,
          before?.usage,
          after?.usage,
          root,
        ),
      ],
    );
    return {
      comparisonPath: "complete",
      view: { ...view, ...evidence, material: true },
      reasons: [{ kind: "material" }, ...(evidence.reasons ?? [])],
      changedImplementations: new Set(),
      ownedResources: ownedResourceReasons(
        evidence.reasons ?? [],
        context.prefix,
        before?.usage,
        after?.usage,
        root,
      ),
    };
  }
  let prepared: PreparedComponentComparison | undefined;
  if (context.useFastPath !== false) {
    const attempt = await compareUnchangedComponentView(
      context,
      before!,
      after!,
      view,
      base,
      head,
      root,
    );
    if (attempt.comparison) return attempt.comparison;
    prepared = attempt.prepared;
  }
  prepared ??= prepareComponentProjection(
    before!,
    after!,
    base,
    head,
    root,
    context.links?.(before!.path, after!.path),
  );
  const { baseRanges, headRanges, projected, excluded } = prepared;
  const reasons: EntryChangeReason[] = [];
  const rootOwnershipChanged = rootResourcesChanged(
    before!.usage,
    after!.usage,
    root,
  );
  if (projected.before !== projected.after) reasons.push({ kind: "material" });
  if (rootOwnershipChanged) reasons.push({ kind: "material" });
  if (projected.inputs) reasons.push({ kind: "inputs" });
  if (projected.structure) reasons.push({ kind: "structure" });
  const actualResource = normalizeReviewPair(
    stripMarkers(base, before?.usage, baseRanges),
    stripMarkers(head, after?.usage, headRanges),
    selected.path,
    context.links?.(before!.path, after!.path),
  );
  const actual = componentPageMaterial(
    before!,
    after!,
    base,
    head,
    prepared,
    root,
    context.links?.(before!.path, after!.path),
  );
  const resourceBefore = projected.resourceBefore ?? projected.before;
  const resourceAfter = projected.resourceAfter ?? projected.after;
  const actualBefore = actualResource.resourceBase ?? actualResource.base;
  const actualAfter = actualResource.resourceHead ?? actualResource.head;
  const repoPath = (path: string) =>
    context.prefix ? `${context.prefix}/${path}` : path;
  const evidence = await context.resources.compare(
    { path: before!.path, html: resourceBefore },
    { path: after!.path, html: resourceAfter },
    excluded,
    { before: actualBefore, after: actualAfter },
  );
  reasons.push(...(evidence.reasons ?? []));
  const actualEvidence = await context.resources.compare(
    {
      path: before!.path,
      html: actualBefore,
      insertedStylesheets: baseStylesheets,
    },
    {
      path: after!.path,
      html: actualAfter,
      insertedStylesheets: headStylesheets,
    },
    undefined,
    undefined,
    () => [
      componentCssDocuments(
        base,
        head,
        selected.path,
        before?.usage,
        after?.usage,
        root,
      ),
    ],
  );
  const byteChanges = context.compareResourceBytes
    ? await changedResourceBytes(
        await context.beforeReader.resources(
          before!.path,
          resourceBefore,
          excluded,
        ),
        await context.afterReader.resources(
          after!.path,
          resourceAfter,
          excluded,
        ),
        context.beforeReader,
        context.afterReader,
        context.resourceIdentity,
      )
    : new Set<string>();
  const actualByteChanges = context.compareResourceBytes
    ? await changedResourceBytes(
        await context.beforeReader.resources(
          before!.path,
          actualBefore,
          undefined,
          baseStylesheets,
        ),
        await context.afterReader.resources(
          after!.path,
          actualAfter,
          undefined,
          headStylesheets,
        ),
        context.beforeReader,
        context.afterReader,
        context.resourceIdentity,
      )
    : new Set<string>();
  if (
    [...byteChanges].some(
      (route) =>
        (!isStylesheetPath(route) || actualByteChanges.has(route)) &&
        !context.changed.has(repoPath(route)),
    )
  )
    reasons.push({ kind: "material" });
  const actualResourceChange =
    Boolean(actualEvidence.reasons?.length) ||
    [...actualByteChanges].some(
      (route) => !context.changed.has(repoPath(route)),
    );
  return {
    comparisonPath: "complete",
    ownedResources: ownedResourceReasons(
      actualEvidence.reasons ?? [],
      context.prefix,
      before?.usage,
      after?.usage,
      root,
    ),
    changedImplementations: changedComponentImplementations(
      base,
      head,
      before?.usage,
      after?.usage,
      baseRanges,
      headRanges,
      context.links?.(before!.path, after!.path),
    ),
    view: {
      ...view,
      ...actualEvidence,
      ignoredIds: actual.ignoredIds,
      ...(actual.base !== actual.head ? { material: true as const } : {}),
      state:
        actual.base !== actual.head ||
        actualResourceChange ||
        rootOwnershipChanged
          ? "changed"
          : projected.rawEqual
            ? "unchanged"
            : "ignored-only",
    },
    reasons,
  };
}

import type {
  GeneratedComponentView,
  EntryChangeReason,
  ViewReview,
} from "@mokly/viewer/data";

import { changedComponentImplementations } from "../components/comparison_projection.js";
import { MoklyError } from "../errors.js";

import { discoverInlineResourceOwners } from "./component_inline_resources.js";
import {
  prepareComponentProjection,
  type PreparedComponentComparison,
} from "./component_projection_resources.js";
import {
  ownedResourceComponents,
  ownedResourceReasons,
  rootResourcesChanged,
} from "./component_resource_attribution.js";
import { componentResourceByteChanges } from "./component_view_resources.js";
import { insertedStylesheetResources } from "./component_stylesheet_resources.js";
import { componentCssDocuments } from "./css/containment.js";
import { compareStyleOnlyView } from "./component_style_route.js";
import { compareUnchangedComponentView } from "./component_view_fast_path.js";
import {
  deliveredInlineStyles,
  compareOneSidedComponentView,
} from "./component_view_material.js";
import { PageAnalysisPair } from "./page_pair.js";

import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view_types.js";
export type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view_types.js";

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
  const view: ViewReview = {
    viewport: selected.viewport,
    colorScheme: selected.colorScheme,
    ignoredIds: [],
    state: before ? "removed" : "added",
  };
  if (base === undefined || head === undefined)
    return compareOneSidedComponentView(
      context,
      before,
      after,
      base ?? head!,
      view,
      root,
    );
  let prepared: PreparedComponentComparison | undefined;
  const pages = context.componentAware
    ? new PageAnalysisPair(
        before!,
        after!,
        base,
        head,
        context.links?.(before!.path, after!.path),
      )
    : undefined;
  if (context.useFastPath !== false) {
    const attempt = await compareUnchangedComponentView(
      context,
      before!,
      after!,
      view,
      base,
      head,
      root,
      pages,
    );
    if (attempt.comparison) return attempt.comparison;
    prepared = attempt.prepared;
  }
  if (pages && context.useStylePath !== false) {
    const comparison = await compareStyleOnlyView(context, pages, view, root);
    if (comparison) return comparison;
  }
  prepared ??= prepareComponentProjection(
    context,
    before!,
    after!,
    base,
    head,
    root,
    {},
    pages,
  );
  const {
    baseRanges,
    headRanges,
    projected,
    excluded,
    matching,
    ownedComponentIds,
    inlineAnalysis,
    inlineEvidence,
    references,
  } = prepared;
  const baseStylesheets = insertedStylesheetResources(
    base,
    before?.usage,
    before!.path,
  );
  const headStylesheets = insertedStylesheetResources(
    head,
    after?.usage,
    after!.path,
  );
  const cssDocuments = () => [
    componentCssDocuments(
      base,
      head,
      selected.path,
      before?.usage,
      after?.usage,
      root,
    ),
  ];
  const rootOwnershipChanged = rootResourcesChanged(
    before?.usage,
    after?.usage,
    root,
  );
  const reasons: EntryChangeReason[] = [];
  if (projected.before !== projected.after) reasons.push({ kind: "material" });
  if (rootOwnershipChanged) reasons.push({ kind: "material" });
  if (projected.inputs) reasons.push({ kind: "inputs" });
  if (projected.structure) reasons.push({ kind: "structure" });
  const actual = projected.actual;
  const resourceBefore = projected.resourceBefore ?? projected.before;
  const resourceAfter = projected.resourceAfter ?? projected.after;
  const actualBefore = actual.resourceBase ?? actual.base;
  const actualAfter = actual.resourceHead ?? actual.head;
  const repoPath = (path: string) =>
    context.prefix ? `${context.prefix}/${path}` : path;
  const evidence = await context.resources.compare(
    {
      path: before!.path,
      html: resourceBefore,
      insertedStylesheets: baseStylesheets,
      ...(references ? { references: references.before } : {}),
    },
    {
      path: after!.path,
      html: resourceAfter,
      insertedStylesheets: headStylesheets,
      ...(references ? { references: references.after } : {}),
    },
    excluded,
    matching,
    cssDocuments,
  );
  reasons.push(...(evidence.reasons ?? []));
  const actualEvidence = await context.resources.compare(
    {
      path: before!.path,
      html: actualBefore,
      insertedStylesheets: baseStylesheets,
      ...(references ? { references: references.actualBefore } : {}),
    },
    {
      path: after!.path,
      html: actualAfter,
      insertedStylesheets: headStylesheets,
      ...(references ? { references: references.actualAfter } : {}),
    },
    undefined,
    matching,
    cssDocuments,
  );
  const inlineOwners = await discoverInlineResourceOwners(
    inlineAnalysis,
    { path: before!.path, reader: context.beforeReader },
    { path: after!.path, reader: context.afterReader },
    context.prefix,
    context.componentAware,
  );
  const byteChanges = await componentResourceByteChanges(
    context,
    {
      path: before!.path,
      html: resourceBefore,
      insertedStylesheets: baseStylesheets,
      ...(references ? { references: references.before } : {}),
    },
    {
      path: after!.path,
      html: resourceAfter,
      insertedStylesheets: headStylesheets,
      ...(references ? { references: references.after } : {}),
    },
    excluded,
  );
  if ([...byteChanges].some((route) => !context.changed.has(repoPath(route))))
    reasons.push({ kind: "material" });
  const actualByteChanges = await componentResourceByteChanges(
    context,
    {
      path: before!.path,
      html: actualBefore,
      insertedStylesheets: baseStylesheets,
      ...(references ? { references: references.actualBefore } : {}),
    },
    {
      path: after!.path,
      html: actualAfter,
      insertedStylesheets: headStylesheets,
      ...(references ? { references: references.actualAfter } : {}),
    },
  );
  const actualResourceChange =
    Boolean(actualEvidence.reasons?.length) ||
    [...actualByteChanges].some(
      (route) => !context.changed.has(repoPath(route)),
    );
  const derivedOwnedComponents = ownedResourceComponents(
    [...actualByteChanges]
      .map(repoPath)
      .filter((path) => !context.changed.has(path)),
    context.prefix,
    inlineOwners,
    before?.usage,
    after?.usage,
    root,
  );
  const comparedView: ViewReview = {
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
  };
  return {
    comparisonPath: "complete",
    ownedResources: ownedResourceReasons(
      actualEvidence.reasons ?? [],
      context.prefix,
      inlineOwners,
      before?.usage,
      after?.usage,
      root,
    ),
    changedImplementations: new Set([
      ...changedComponentImplementations(
        base,
        head,
        before?.usage,
        after?.usage,
        baseRanges,
        headRanges,
        context.links?.(before!.path, after!.path),
      ),
      ...ownedComponentIds,
      ...derivedOwnedComponents,
    ]),
    ...(inlineEvidence ? { inlineEvidence } : {}),
    view: {
      ...comparedView,
      ...deliveredInlineStyles(inlineEvidence, comparedView, reasons),
    },
    reasons,
  };
}

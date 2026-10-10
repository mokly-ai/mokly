import type {
  GeneratedComponentView,
  EntryChangeReason,
  ViewReview,
} from "@mokly/viewer/data";

import { changedComponentImplementations } from "../components/comparison_projection.js";

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
import { insertedStylesheetResources } from "./component_stylesheet_resources.js";
import { deliveredInlineStyles } from "./component_view_material.js";
import {
  componentResourceByteChanges,
  byteMaterialChanged,
} from "./component_view_resources.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view_types.js";
import { componentCssDocuments } from "./css/containment.js";
import type { PageAnalysisPair } from "./page_pair.js";
/** Complete comparison shares the original analyses left by either shortcut. */
export async function compareCompleteComponentView(
  context: ComponentViewContext,
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  base: string,
  head: string,
  view: ViewReview,
  root: string | undefined,
  pages: PageAnalysisPair | undefined,
  prepared: PreparedComponentComparison | undefined,
): Promise<ComparedComponentView> {
  const selected = after;
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
    pages?.beforeAnalysis.document,
  );
  const headStylesheets = insertedStylesheetResources(
    head,
    after?.usage,
    after!.path,
    pages?.afterAnalysis.document,
  );
  const cssDocuments = pages
    ? () => [
        componentCssDocuments(
          base,
          head,
          selected.path,
          before?.usage,
          after?.usage,
          root,
          pages
            ? {
                before: pages.beforeAnalysis,
                after: pages.afterAnalysis,
                paired: pages.pairedIgnoreIds,
              }
            : undefined,
        ),
      ]
    : undefined;
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
      ...(references ? { references: references.before } : {}),
    },
    {
      path: after!.path,
      html: resourceAfter,
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
      ...(references ? { references: references.before } : {}),
    },
    {
      path: after!.path,
      html: resourceAfter,
      ...(references ? { references: references.after } : {}),
    },
    excluded,
  );
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
  if (
    byteMaterialChanged(
      byteChanges,
      actualByteChanges,
      context.changed,
      repoPath,
    )
  )
    reasons.push({ kind: "material" });
  const actualResourceChange =
    Boolean(actualEvidence.reasons?.length) ||
    byteMaterialChanged(
      actualByteChanges,
      actualByteChanges,
      context.changed,
      repoPath,
    );
  const derivedOwnedComponents = ownedResourceComponents(
    [...actualByteChanges.changes]
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

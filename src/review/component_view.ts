import type {
  GeneratedComponentView,
  EntryChangeReason,
  ViewReview,
} from "@mokly/viewer/data";

import { changedComponentImplementations } from "../components/comparison_projection.js";
import { MoklyError } from "../errors.js";

import { discoverInlineResourceOwners } from "./component_inline_resources.js";
import type { ComponentDependencyPolicy } from "./component_metadata.js";
import {
  prepareComponentProjection,
  type PreparedComponentComparison,
  type PreparedInlineStyleEvidence,
} from "./component_projection_resources.js";
import {
  ownedResourceComponents,
  ownedResourceReasons,
  type OwnedResourceReason,
} from "./component_resource_attribution.js";
import { changedResourceBytes } from "./component_resource_changes.js";
import type { ComponentMaterialReader } from "./component_resources.js";
import { compareStyleOnlyView } from "./component_style_route.js";
import { compareUnchangedComponentView } from "./component_view_fast_path.js";
import {
  deliveredInlineStyles,
  compareOneSidedComponentView,
} from "./component_view_material.js";
import { PageAnalysisPair } from "./page_pair.js";
import type { ResourceComparison } from "./resource_comparison.js";

export interface ComparedComponentView {
  comparisonPath: "fast" | "style" | "complete";
  view: ViewReview;
  reasons: readonly EntryChangeReason[];
  changedImplementations: ReadonlySet<string>;
  ownedResources: readonly OwnedResourceReason[];
  inlineEvidence?: PreparedInlineStyleEvidence;
}
export interface ComponentViewContext {
  componentAware: boolean;
  beforeReader: ComponentMaterialReader;
  afterReader: ComponentMaterialReader;
  dependencies: ComponentDependencyPolicy;
  changed: ReadonlySet<string>;
  prefix: string;
  resources: ResourceComparison;
  compareResourceBytes?: boolean;
  useFastPath?: boolean;
  useStylePath?: boolean;
  /** Test-only: retain delivered text materials instead of fingerprints. */
  useMaterialFingerprints?: boolean;
}

/** Compare material and declared inputs without altering the retained view documents. */
export async function compareComponentView(
  context: ComponentViewContext,
  before: GeneratedComponentView | undefined,
  after: GeneratedComponentView | undefined,
  root?: string,
): Promise<ComparedComponentView> {
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
    ? new PageAnalysisPair(before!, after!, base, head)
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
  const reasons: EntryChangeReason[] = [];
  if (projected.before !== projected.after) reasons.push({ kind: "material" });
  if (projected.inputs) reasons.push({ kind: "inputs" });
  if (projected.structure) reasons.push({ kind: "structure" });
  const actual = projected.actual;
  const repoPath = (path: string) =>
    context.prefix ? `${context.prefix}/${path}` : path;
  const evidence = await context.resources.compare(
    {
      path: before!.path,
      html: projected.before,
      ...(references ? { references: references.before } : {}),
    },
    {
      path: after!.path,
      html: projected.after,
      ...(references ? { references: references.after } : {}),
    },
    excluded,
    matching,
  );
  reasons.push(...(evidence.reasons ?? []));
  const actualEvidence = await context.resources.compare(
    {
      path: before!.path,
      html: actual.base,
      ...(references ? { references: references.actualBefore } : {}),
    },
    {
      path: after!.path,
      html: actual.head,
      ...(references ? { references: references.actualAfter } : {}),
    },
    undefined,
    matching,
  );
  const inlineOwners = await discoverInlineResourceOwners(
    inlineAnalysis,
    { path: before!.path, reader: context.beforeReader },
    { path: after!.path, reader: context.afterReader },
    context.prefix,
    context.componentAware,
  );
  const byteChanges = context.compareResourceBytes
    ? await changedResourceBytes(
        await context.beforeReader.resources(
          before!.path,
          projected.before,
          excluded,
          references?.before,
        ),
        await context.afterReader.resources(
          after!.path,
          projected.after,
          excluded,
          references?.after,
        ),
        context.beforeReader,
        context.afterReader,
      )
    : new Set<string>();
  if ([...byteChanges].some((route) => !context.changed.has(repoPath(route))))
    reasons.push({ kind: "material" });
  const actualByteChanges = context.compareResourceBytes
    ? await changedResourceBytes(
        await context.beforeReader.resources(
          before!.path,
          actual.base,
          undefined,
          references?.actualBefore,
        ),
        await context.afterReader.resources(
          after!.path,
          actual.head,
          undefined,
          references?.actualAfter,
        ),
        context.beforeReader,
        context.afterReader,
      )
    : new Set<string>();
  const actualResourceChange =
    Boolean(actualEvidence.reasons?.length) ||
    [...actualByteChanges].some(
      (route) => !context.changed.has(repoPath(route)),
    );
  const derivedOwnedComponents = ownedResourceComponents(
    [...actualByteChanges]
      .map(repoPath)
      .filter((path) => !context.changed.has(path)),
    context.dependencies,
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
      actual.base !== actual.head || actualResourceChange
        ? "changed"
        : projected.rawEqual
          ? "unchanged"
          : "ignored-only",
  };
  return {
    comparisonPath: "complete",
    ownedResources: ownedResourceReasons(
      actualEvidence.reasons ?? [],
      context.dependencies,
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

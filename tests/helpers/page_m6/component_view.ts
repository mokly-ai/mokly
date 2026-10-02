import type {
  GeneratedComponentView,
  EntryChangeReason,
  InlineStyleEvidence,
  ViewReview,
} from "@mokly/viewer/data";

import { validateComponentRanges } from "../../../dist/components/ranges.js";
import { MoklyError } from "../../../dist/errors.js";
import {
  discoverInlineResourceOwners,
  type InlineResourceOwners,
} from "../../../dist/review/component_inline_resources.js";
import type { ComponentDependencyPolicy } from "../../../dist/review/component_metadata.js";
import {
  ownedResourceComponents,
  ownedResourceReasons,
  type OwnedResourceReason,
} from "../../../dist/review/component_resource_attribution.js";
import { changedResourceBytes } from "../../../dist/review/component_resource_changes.js";
import type { ComponentMaterialReader } from "../../../dist/review/component_resources.js";
import { normalizeSingleDocument } from "../../../dist/review/ignore.js";
import type { ResourceComparison } from "../../../dist/review/resource_comparison.js";

import { stripMarkers } from "./comparison_material.js";
import { changedComponentImplementations } from "./comparison_projection.js";
import {
  prepareComponentProjection,
  type PreparedComponentComparison,
  type PreparedInlineStyleEvidence,
} from "./component_projection_resources.js";
import { compareUnchangedComponentView } from "./component_view_fast_path.js";

export interface ComparedComponentView {
  comparisonPath: "fast" | "complete";
  view: ViewReview;
  reasons: readonly EntryChangeReason[];
  changedImplementations: ReadonlySet<string>;
  ownedResources: readonly OwnedResourceReason[];
  inlineEvidence?: PreparedInlineStyleEvidence;
}
export interface ComponentViewContext {
  beforeReader: ComponentMaterialReader;
  afterReader: ComponentMaterialReader;
  dependencies: ComponentDependencyPolicy;
  changed: ReadonlySet<string>;
  prefix: string;
  resources: ResourceComparison;
  compareResourceBytes?: boolean;
  useFastPath?: boolean;
}
const EMPTY_INLINE_OWNERS: InlineResourceOwners = new Map();

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
  if (base === undefined || head === undefined) {
    const normalized =
      base !== undefined
        ? normalizeOneSidedView(base, before!)
        : normalizeOneSidedView(head!, after!);
    const evidence = await context.resources.compare(
      before ? { path: before.path, html: normalized } : undefined,
      after ? { path: after.path, html: normalized } : undefined,
    );
    return {
      comparisonPath: "complete",
      view: { ...view, ...evidence, material: true },
      reasons: [{ kind: "material" }, ...(evidence.reasons ?? [])],
      changedImplementations: new Set(),
      ownedResources: ownedResourceReasons(
        evidence.reasons ?? [],
        context.dependencies,
        EMPTY_INLINE_OWNERS,
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
    context,
    before!,
    after!,
    base,
    head,
    root,
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
  } = prepared;
  const reasons: EntryChangeReason[] = [];
  if (projected.before !== projected.after) reasons.push({ kind: "material" });
  if (projected.inputs) reasons.push({ kind: "inputs" });
  if (projected.structure) reasons.push({ kind: "structure" });
  const actual = projected.actual;
  const repoPath = (path: string) =>
    context.prefix ? `${context.prefix}/${path}` : path;
  const evidence = await context.resources.compare(
    { path: before!.path, html: projected.before },
    { path: after!.path, html: projected.after },
    excluded,
    matching,
  );
  reasons.push(...(evidence.reasons ?? []));
  const actualEvidence = await context.resources.compare(
    { path: before!.path, html: actual.base },
    { path: after!.path, html: actual.head },
    undefined,
    matching,
  );
  const inlineOwners = await discoverInlineResourceOwners(
    inlineAnalysis,
    { path: before!.path, reader: context.beforeReader },
    { path: after!.path, reader: context.afterReader },
    context.prefix,
  );
  const byteChanges = context.compareResourceBytes
    ? await changedResourceBytes(
        await context.beforeReader.resources(
          before!.path,
          projected.before,
          excluded,
        ),
        await context.afterReader.resources(
          after!.path,
          projected.after,
          excluded,
        ),
        context.beforeReader,
        context.afterReader,
      )
    : new Set<string>();
  if ([...byteChanges].some((route) => !context.changed.has(repoPath(route))))
    reasons.push({ kind: "material" });
  const actualByteChanges = context.compareResourceBytes
    ? await changedResourceBytes(
        await context.beforeReader.resources(before!.path, actual.base),
        await context.afterReader.resources(after!.path, actual.head),
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

function deliveredInlineStyles(
  evidence: PreparedInlineStyleEvidence | undefined,
  view: ViewReview,
  reasons: readonly EntryChangeReason[],
): { inlineStyles?: InlineStyleEvidence } {
  if (evidence?.retainedSelectors && view.state === "changed" && view.material)
    return { inlineStyles: evidence.retainedSelectors };
  if (
    evidence?.allExcluded &&
    reasons.length === 0 &&
    view.state === "unchanged" &&
    !view.material &&
    !view.reasons
  )
    return { inlineStyles: { status: "excluded" } };
  return {};
}

function normalizeOneSidedView(
  html: string,
  view: GeneratedComponentView,
): string {
  const ranges = view.usage
    ? validateComponentRanges(html, view.usage.ranges)
    : undefined;
  const material = stripMarkers(html, view.usage, ranges);
  return normalizeSingleDocument(material, view.path);
}

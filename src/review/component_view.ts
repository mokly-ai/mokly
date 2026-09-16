import type {
  GeneratedComponentView,
  EntryChangeReason,
  ViewReview,
} from "@mokly/viewer/data";

import {
  stripHistoricalMarkers,
  stripMarkers,
} from "../components/comparison_material.js";
import {
  changedComponentImplementations,
  projectComponentPair,
} from "../components/comparison_projection.js";
import { validateComponentRanges } from "../components/ranges.js";
import { MoklyError } from "../errors.js";

import type { ComponentDependencyPolicy } from "./component_metadata.js";
import {
  ownedCssReasons,
  type OwnedCssReason,
} from "./component_resource_attribution.js";
import { changedResourceBytes } from "./component_resource_changes.js";
import type { ComponentMaterialReader } from "./component_resources.js";
import { normalizeReviewPair, normalizeSingleDocument } from "./ignore.js";
import { snapshotPath } from "./paths.js";
import type { ResourceComparison } from "./resource_comparison.js";

export interface ComparedComponentView {
  view: ViewReview;
  reasons: readonly EntryChangeReason[];
  changedImplementations: ReadonlySet<string>;
  ownedResources: readonly OwnedCssReason[];
}
export interface ComponentViewContext {
  beforeReader: ComponentMaterialReader;
  afterReader: ComponentMaterialReader;
  dependencies: ComponentDependencyPolicy;
  changed: ReadonlySet<string>;
  prefix: string;
  resources: ResourceComparison;
  compareResourceBytes?: boolean;
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
  const baseRanges =
    base !== undefined && before?.usage
      ? validateComponentRanges(base, before.usage.ranges, "historical")
      : undefined;
  const headRanges =
    head !== undefined && after?.usage
      ? validateComponentRanges(head, after.usage.ranges)
      : undefined;
  const view: ViewReview = {
    viewport: selected.viewport,
    colorScheme: selected.colorScheme,
    ignoredIds: [],
    ...(before ? { beforePath: snapshotPath("before", before.path) } : {}),
    ...(after ? { afterPath: snapshotPath("after", after.path) } : {}),
    state: before ? "removed" : "added",
  };
  if (base === undefined || head === undefined) {
    const normalized = normalizeSingleDocument(
      base !== undefined
        ? stripHistoricalMarkers(base)
        : stripMarkers(head!, after!.usage, headRanges),
      selected.path,
    );
    const evidence = await context.resources.compare(
      before ? { path: before.path, html: normalized } : undefined,
      after ? { path: after.path, html: normalized } : undefined,
    );
    return {
      view: { ...view, ...evidence, material: true },
      reasons: [{ kind: "material" }, ...(evidence.reasons ?? [])],
      changedImplementations: new Set(),
      ownedResources: ownedCssReasons(
        evidence.reasons ?? [],
        context.dependencies,
        context.prefix,
        before?.usage,
        after?.usage,
        root,
      ),
    };
  }
  const projected = projectComponentPair(
    base,
    head,
    before?.usage,
    after?.usage,
    selected.path,
    root,
    baseRanges,
    headRanges,
  );
  const reasons: EntryChangeReason[] = [];
  if (projected.before !== projected.after) reasons.push({ kind: "material" });
  if (projected.inputs) reasons.push({ kind: "inputs" });
  if (projected.structure) reasons.push({ kind: "structure" });
  const actual = normalizeReviewPair(
    stripHistoricalMarkers(base),
    stripMarkers(head, after?.usage, headRanges),
    selected.path,
  );
  const repoPath = (path: string) =>
    context.prefix ? `${context.prefix}/${path}` : path;
  const excluded = (path: string) =>
    context.dependencies.suppressResource(
      repoPath(path),
      path,
      projected.pairedComponentIds,
      before?.usage,
      after?.usage,
      root,
    );
  const evidence = await context.resources.compare(
    { path: before!.path, html: projected.before },
    { path: after!.path, html: projected.after },
    excluded,
    { before: actual.base, after: actual.head },
  );
  reasons.push(...(evidence.reasons ?? []));
  const actualEvidence = await context.resources.compare(
    { path: before!.path, html: actual.base },
    { path: after!.path, html: actual.head },
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
        await context.beforeReader.resources(
          before!.path,
          actual.base,
          () => false,
        ),
        await context.afterReader.resources(
          after!.path,
          actual.head,
          () => false,
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
  return {
    ownedResources: ownedCssReasons(
      actualEvidence.reasons ?? [],
      context.dependencies,
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
    ),
    view: {
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
    },
    reasons,
  };
}

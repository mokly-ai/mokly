import type {
  GeneratedComponentView,
  EntryChangeReason,
  ViewReview,
} from "@mokly/viewer/data";
import { canonicalJson } from "@mokly/viewer/data";

import {
  stripHistoricalMarkers,
  stripMarkers,
} from "../components/comparison_material.js";
import { changedComponentImplementations } from "../components/comparison_projection.js";
import { comparisonStylesheetMaterial } from "../components/comparison_stylesheets.js";
import { validateComponentRanges } from "../components/ranges.js";
import { MoklyError } from "../errors.js";

import {
  prepareComponentProjection,
  type PreparedComponentComparison,
} from "./component_projection_resources.js";
import {
  ownedResourceReasons,
  type OwnedResourceReason,
} from "./component_resource_attribution.js";
import { changedResourceBytes } from "./component_resource_changes.js";
import type { ComponentMaterialReader } from "./component_resources.js";
import { compareUnchangedComponentView } from "./component_view_fast_path.js";
import { normalizeReviewPair, normalizeSingleDocument } from "./ignore.js";
import { snapshotPath } from "./paths.js";
import type { ResourceComparison } from "./resource_comparison.js";

export interface ComparedComponentView {
  comparisonPath: "fast" | "complete";
  view: ViewReview;
  reasons: readonly EntryChangeReason[];
  changedImplementations: ReadonlySet<string>;
  ownedResources: readonly OwnedResourceReason[];
}
export interface ComponentViewContext {
  beforeReader: ComponentMaterialReader;
  afterReader: ComponentMaterialReader;
  changed: ReadonlySet<string>;
  prefix: string;
  resources: ResourceComparison;
  compareResourceBytes?: boolean;
  useFastPath?: boolean;
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
    ...(before ? { beforePath: snapshotPath("before", before.path) } : {}),
    ...(after ? { afterPath: snapshotPath("after", after.path) } : {}),
    state: before ? "removed" : "added",
  };
  if (base === undefined || head === undefined) {
    const normalized =
      base !== undefined
        ? normalizeOneSidedView(base, before!, "historical", root)
        : normalizeOneSidedView(head!, after!, "current", root);
    const evidence = await context.resources.compare(
      before ? { path: before.path, html: normalized.resource } : undefined,
      after ? { path: after.path, html: normalized.resource } : undefined,
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
  prepared ??= prepareComponentProjection(before!, after!, base, head, root);
  const { baseRanges, headRanges, projected, excluded } = prepared;
  const reasons: EntryChangeReason[] = [];
  const rootOwnershipChanged = Boolean(
    root &&
    canonicalJson(
      before!.usage?.resources
        .filter((resource) => resource.componentIds.includes(root))
        .map((resource) => resource.path) ?? [],
    ) !==
      canonicalJson(
        after!.usage?.resources
          .filter((resource) => resource.componentIds.includes(root))
          .map((resource) => resource.path) ?? [],
      ),
  );
  if (projected.before !== projected.after) reasons.push({ kind: "material" });
  if (rootOwnershipChanged) reasons.push({ kind: "material" });
  if (projected.inputs) reasons.push({ kind: "inputs" });
  if (projected.structure) reasons.push({ kind: "structure" });
  const actualResource = normalizeReviewPair(
    stripHistoricalMarkers(base),
    stripMarkers(head, after?.usage, headRanges),
    selected.path,
  );
  const baseMaterial = comparisonStylesheetMaterial(base, before!.usage, root);
  const headMaterial = comparisonStylesheetMaterial(head, after!.usage, root);
  const actual = normalizeReviewPair(
    stripHistoricalMarkers(baseMaterial.html),
    stripMarkers(
      headMaterial.html,
      headMaterial.usage,
      headMaterial.html === head ? headRanges : undefined,
    ),
    selected.path,
  );
  const repoPath = (path: string) =>
    context.prefix ? `${context.prefix}/${path}` : path;
  const evidence = await context.resources.compare(
    { path: before!.path, html: projected.before },
    { path: after!.path, html: projected.after },
    excluded,
    { before: actualResource.base, after: actualResource.head },
  );
  reasons.push(...(evidence.reasons ?? []));
  const actualEvidence = await context.resources.compare(
    { path: before!.path, html: actualResource.base },
    { path: after!.path, html: actualResource.head },
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
        await context.beforeReader.resources(before!.path, actualResource.base),
        await context.afterReader.resources(after!.path, actualResource.head),
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
    ),
    view: {
      ...view,
      ...actualEvidence,
      ignoredIds: actual.ignoredIds,
      ...(actual.base !== actual.head || rootOwnershipChanged
        ? { material: true as const }
        : {}),
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

function normalizeOneSidedView(
  html: string,
  view: GeneratedComponentView,
  dialect: "current" | "historical",
  root?: string,
): { page: string; resource: string } {
  const ranges = view.usage
    ? validateComponentRanges(html, view.usage.ranges, dialect)
    : undefined;
  const compared = comparisonStylesheetMaterial(html, view.usage, root);
  const material =
    dialect === "historical"
      ? stripHistoricalMarkers(compared.html)
      : stripMarkers(compared.html, compared.usage);
  const original =
    dialect === "historical"
      ? stripHistoricalMarkers(html)
      : stripMarkers(html, view.usage, ranges);
  return {
    page: normalizeSingleDocument(material, view.path),
    resource: normalizeSingleDocument(original, view.path),
  };
}

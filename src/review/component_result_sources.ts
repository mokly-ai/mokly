import {
  generatedViews,
  isManifestComponentVariant,
  parseReviewResult,
  requireEqual,
  reviewInvalid,
} from "@mokly/viewer/data";
import type { Manifest, ReviewResultV5, ViewReview } from "@mokly/viewer/data";

import { affectedConsumers } from "./component_affected.js";
import {
  address,
  baselineForCurrentIdentities,
  entryPairKey,
  entryPairs,
  metadata,
  type ReviewEntry,
} from "./component_metadata.js";
import { variantAddress } from "./component_pairing.js";
import { componentVariantEntries } from "./component_variant_classification.js";

/** Classifier evidence that can justify an entry's `dependency` reasons. */
export interface DependencyReasonSources {
  /** Paths contributed by filtered policy, views, exact screen CSS, or owned CSS. */
  pathsByEntry: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Validate result coverage, addresses, dependency sources, and usage against both manifests. */
export function validateComponentReviewSources(
  result: ReviewResultV5,
  before: Manifest,
  after: Manifest,
  implementationImpact: ReadonlySet<string>,
  sources: DependencyReasonSources,
): void {
  parseReviewResult(result);
  before = baselineForCurrentIdentities(before, after);
  const beforeVariants = componentVariantEntries(before.entries);
  const afterVariants = componentVariantEntries(after.entries);
  const pairs = entryPairs(before, after);
  const expectedScreens = pairs.filter(
    (pair) => (pair.after ?? pair.before)!.kind === "screen",
  );
  const expectedComponents = pairs.filter((pair) => {
    return [pair.before, pair.after].some(
      (entry) =>
        entry?.kind === "component" && !isManifestComponentVariant(entry),
    );
  });
  if (
    expectedScreens.length !== result.screens.length ||
    expectedComponents.length !== result.components.length
  )
    reviewInvalid("source/result coverage differs");
  for (const pair of pairs) {
    const entry = (pair.after ?? pair.before)!;
    const sides = {
      ...(pair.before ? { before: address(pair.before) } : {}),
      ...(pair.after ? { after: address(pair.after) } : {}),
    };
    const record =
      entry.kind === "screen"
        ? result.screens.find((screen) => screen.path === entry.path)
        : entry.kind === "component" &&
            [pair.before, pair.after].some(
              (candidate) =>
                candidate?.kind === "component" &&
                !isManifestComponentVariant(candidate),
            )
          ? result.components.find((component) => component.path === entry.path)
          : undefined;
    if (
      entry.kind !== "use-case" &&
      !(entry.kind === "component" && isManifestComponentVariant(entry)) &&
      !record
    )
      reviewInvalid("source entry has no result");
    if (record)
      requireEqual({ before: record.before, after: record.after }, sides);
    validateChange(result, pair.before, pair.after, sources, before, after);
    if (!record) continue;
    if ("views" in record) {
      validateViews(
        record.views,
        pair.before ? generatedViews(pair.before) : [],
        pair.after ? generatedViews(pair.after) : [],
      );
      continue;
    }
    const baseVariants = variantsFor(
      beforeVariants,
      pair.before?.kind === "component" &&
        !isManifestComponentVariant(pair.before)
        ? pair.before.path
        : undefined,
    );
    const headVariants = variantsFor(
      afterVariants,
      pair.after?.kind === "component" &&
        !isManifestComponentVariant(pair.after)
        ? pair.after.path
        : undefined,
    );
    const ids = [...new Set([...headVariants.keys(), ...baseVariants.keys()])];
    requireEqual(
      record.variants.map((variant) => variant.path),
      ids.map((key) => (headVariants.get(key) ?? baseVariants.get(key))!.path),
    );
    for (const variant of record.variants) {
      const base = baseVariants.get(variant.path.toLowerCase());
      const head = headVariants.get(variant.path.toLowerCase());
      requireEqual(
        { before: variant.before, after: variant.after },
        {
          before: base ? variantAddress(base) : undefined,
          after: head ? variantAddress(head) : undefined,
        },
      );
      validateViews(
        variant.views,
        base ? generatedViews(base) : [],
        head ? generatedViews(head) : [],
      );
    }
  }
  requireEqual(
    result.affectedConsumers,
    affectedConsumers(before, after, implementationImpact),
  );
}

function validateChange(
  result: ReviewResultV5,
  beforeEntry: ReviewEntry | undefined,
  afterEntry: ReviewEntry | undefined,
  sources: DependencyReasonSources,
  before: Manifest,
  after: Manifest,
): void {
  const selected = afterEntry ?? beforeEntry;
  if (!selected) return;
  const change = result.changes.find(
    (candidate) =>
      candidate.kind === selected.kind &&
      (candidate.after ?? candidate.before)?.path === selected.path,
  );
  if (!change) return;
  requireEqual(
    { before: change.before, after: change.after },
    {
      before: beforeEntry ? address(beforeEntry) : undefined,
      after: afterEntry ? address(afterEntry) : undefined,
    },
  );
  for (const reason of change.reasons) {
    if (
      reason.kind === "dependency" &&
      !sources.pathsByEntry.get(entryPairKey(selected))?.has(reason.path)
    )
      reviewInvalid("dependency reason has no source evidence");
    if (
      reason.kind === "metadata" &&
      (!beforeEntry ||
        !afterEntry ||
        (metadata(beforeEntry) === metadata(afterEntry) &&
          !variantParentTitleChanged(beforeEntry, afterEntry, before, after)))
    )
      reviewInvalid("metadata reason has no source difference");
    if (
      reason.kind === "screen" &&
      ![beforeEntry, afterEntry].some(
        (candidate, index) =>
          candidate?.kind === "use-case" &&
          candidate.steps.some((step) =>
            (index === 0 ? before : after).entries.some(
              (screen) =>
                screen.kind === "screen" &&
                screen.path === step.screenPath &&
                screen.path === reason.screenPath,
            ),
          ),
      )
    )
      reviewInvalid("use case does not use the changed screen");
  }
}

function variantParentTitleChanged(
  beforeEntry: ReviewEntry,
  afterEntry: ReviewEntry,
  before: Manifest,
  after: Manifest,
): boolean {
  if (
    beforeEntry.kind !== "component" ||
    afterEntry.kind !== "component" ||
    !isManifestComponentVariant(beforeEntry) ||
    !isManifestComponentVariant(afterEntry) ||
    beforeEntry.variantOf !== afterEntry.variantOf
  )
    return false;
  const parentTitle = (manifest: Manifest, id: string) =>
    manifest.entries.find(
      (entry) =>
        entry.kind === "component" &&
        !isManifestComponentVariant(entry) &&
        entry.path === id,
    )?.title;
  return (
    parentTitle(before, beforeEntry.variantOf) !==
    parentTitle(after, afterEntry.variantOf)
  );
}

function variantsFor(
  variants: ReturnType<typeof componentVariantEntries>,
  parentId: string | undefined,
) {
  return new Map(
    [...variants.values()]
      .filter((variant) => variant.variantOf === parentId)
      .map((variant) => [variant.path.toLowerCase(), variant]),
  );
}

function validateViews(
  views: readonly ViewReview[],
  before: ReturnType<typeof generatedViews>,
  after: ReturnType<typeof generatedViews>,
): void {
  const key = (view: { viewport: string; colorScheme: string }) =>
    `${view.viewport}:${view.colorScheme}`;
  const bases = new Set(before.map(key));
  const heads = new Set(after.map(key));
  if (views.length !== new Set([...bases, ...heads]).size)
    reviewInvalid("view union is incomplete");
  for (const view of views) {
    const base = bases.has(key(view));
    const head = heads.has(key(view));
    if (
      (!base && view.state !== "added") ||
      (!head && view.state !== "removed") ||
      (base && head && ["added", "removed"].includes(view.state))
    )
      reviewInvalid("view state differs from source sides");
  }
}

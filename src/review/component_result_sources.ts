import {
  generatedViews,
  requireEqual,
  reviewInvalid,
  parseReviewResult,
} from "@mokly/viewer/data";
import type { Manifest, ReviewResultV3, ViewReview } from "@mokly/viewer/data";

import { affectedConsumers } from "./component_affected.js";
import { address, entryPairs, metadata } from "./component_metadata.js";
import { variantAddress } from "./component_pairing.js";
import { snapshotPath } from "./paths.js";

/** Validate result coverage, addresses, data, dependency and usage references against both manifests. */
export function validateComponentReviewSources(
  result: ReviewResultV3,
  before: Manifest,
  after: Manifest,
  implementationImpact: ReadonlySet<string>,
): void {
  parseReviewResult(result);
  const pairs = entryPairs(before, after);
  const expectedScreens = pairs.filter(
    (pair) => (pair.after ?? pair.before)!.kind === "screen",
  );
  const expectedComponents = pairs.filter(
    (pair) => (pair.after ?? pair.before)!.kind === "component",
  );
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
        ? result.screens.find((screen) => screen.route === entry.route)
        : entry.kind === "component"
          ? result.components.find((component) => component.id === entry.id)
          : undefined;
    if (entry.kind !== "use-case" && !record)
      reviewInvalid("source entry has no result");
    if (record)
      requireEqual({ before: record.before, after: record.after }, sides);
    const change = result.changes.find(
      (change) =>
        change.kind === entry.kind &&
        (change.after ?? change.before)!.route === entry.route,
    );
    if (change) {
      requireEqual({ before: change.before, after: change.after }, sides);
      for (const reason of change.reasons) {
        if (
          reason.kind === "metadata" &&
          (!pair.before ||
            !pair.after ||
            metadata(pair.before, before) === metadata(pair.after, after))
        )
          reviewInvalid("metadata reason has no source difference");
        if (
          reason.kind === "screen" &&
          ![pair.before, pair.after].some(
            (candidate, index) =>
              candidate?.kind === "use-case" &&
              candidate.steps.some((step) =>
                (index === 0 ? before : after).entries.some(
                  (screen) =>
                    screen.kind === "screen" &&
                    screen.id === step.screenId &&
                    screen.route === reason.route,
                ),
              ),
          )
        )
          reviewInvalid("use case does not use the changed screen");
      }
    }
    if (!record) continue;
    const baseViews = pair.before ? generatedViews(pair.before) : [];
    const headViews = pair.after ? generatedViews(pair.after) : [];
    if ("views" in record) validateViews(record.views, baseViews, headViews);
    else {
      const baseVariants =
        pair.before?.kind === "component" ? pair.before.variants : [];
      const headVariants =
        pair.after?.kind === "component" ? pair.after.variants : [];
      const ids = [
        ...new Set([
          ...headVariants.map((variant) => variant.id),
          ...baseVariants.map((variant) => variant.id),
        ]),
      ];
      requireEqual(
        record.variants.map((variant) => variant.id),
        ids,
      );
      for (const variant of record.variants) {
        const base = baseVariants.find(
          (candidate) => candidate.id === variant.id,
        );
        const head = headVariants.find(
          (candidate) => candidate.id === variant.id,
        );
        requireEqual(
          { before: variant.before, after: variant.after },
          {
            before: base ? variantAddress(base) : undefined,
            after: head ? variantAddress(head) : undefined,
          },
        );
        validateViews(
          variant.views,
          baseViews.filter((view) => view.variantId === variant.id),
          headViews.filter((view) => view.variantId === variant.id),
        );
      }
    }
  }
  requireEqual(
    result.affectedConsumers,
    affectedConsumers(before, after, implementationImpact),
  );
}
function validateViews(
  views: readonly ViewReview[],
  before: ReturnType<typeof generatedViews>,
  after: ReturnType<typeof generatedViews>,
): void {
  const key = (view: { viewport: string; colorScheme: string }) =>
    `${view.viewport}:${view.colorScheme}`;
  const bases = new Map(before.map((view) => [key(view), view.path]));
  const heads = new Map(after.map((view) => [key(view), view.path]));
  if (views.length !== new Set([...bases.keys(), ...heads.keys()]).size)
    reviewInvalid("view union is incomplete");
  for (const view of views) {
    const base = bases.get(key(view));
    const head = heads.get(key(view));
    requireEqual(
      { beforePath: view.beforePath, afterPath: view.afterPath },
      {
        beforePath: base ? snapshotPath("before", base) : undefined,
        afterPath: head ? snapshotPath("after", head) : undefined,
      },
    );
  }
}

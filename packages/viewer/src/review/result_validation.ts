import { canonicalJson } from "../components/data.js";

import type { ReviewResultV3 } from "./component_types.js";
import {
  requireEqual,
  requireOrdered,
  reviewArray,
  reviewId,
  reviewInvalid,
  reviewObject,
  reviewPath,
  reviewString,
  reviewStrings,
} from "./result_helpers.js";
import {
  validateAffected,
  validateChangedEntry,
  validateReviewScreen,
} from "./result_records.js";
import type { ReviewResult } from "./types.js";

/** Shared browser/server decoder preserves material flags and validates each view's evidence. */
export function parseReviewResult(value: unknown): ReviewResult {
  try {
    return validateResult(value);
  } catch (error) {
    reviewInvalid(
      error instanceof Error ? error.message : "invalid comparison",
    );
  }
}
function validateResult(value: unknown): ReviewResult {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    (value.schemaVersion !== 2 && value.schemaVersion !== 3)
  )
    reviewInvalid("unsupported result version");
  const version = value.schemaVersion;
  const result = reviewObject(value, [
    "schemaVersion",
    "baseCommit",
    "baseRef",
    "changedPaths",
    "ignoredImpact",
    "screens",
    "sharedImpact",
    ...(version === 3 ? ["components", "changes", "affectedConsumers"] : []),
  ]);
  if (!/^[a-f0-9]{40,64}$/.test(reviewString(result.baseCommit)))
    reviewInvalid("invalid base commit");
  reviewString(result.baseRef);
  const changed = reviewStrings(result.changedPaths, reviewPath);
  reviewStrings(result.sharedImpact, reviewPath);
  const screens = reviewArray(result.screens).map((screen) =>
    validateReviewScreen(screen, version, false, changed),
  );
  requireOrdered(screens, (screen) => String(screen.route));
  const ignoredKeys: string[] = [];
  for (const raw of reviewArray(result.ignoredImpact)) {
    const impact = reviewObject(raw, [
      "viewport",
      "colorScheme",
      "id",
      "count",
    ]);
    reviewId(impact.id);
    if (
      !["mobile", "desktop"].includes(String(impact.viewport)) ||
      !["light", "dark"].includes(String(impact.colorScheme)) ||
      !Number.isSafeInteger(impact.count) ||
      Number(impact.count) < 1
    )
      reviewInvalid("invalid ignored impact");
    ignoredKeys.push(
      `${impact.viewport === "mobile" ? 0 : 1}:${impact.colorScheme === "light" ? 0 : 1}:${impact.id}`,
    );
  }
  requireOrdered(ignoredKeys, (key) => key);
  if (version === 3) {
    const components = reviewArray(result.components).map((component) =>
      validateReviewScreen(component, 3, true, changed),
    );
    requireOrdered(components, (component) => String(component.id));
    const changes = reviewArray(result.changes).map((entry) =>
      validateChangedEntry(entry, changed),
    );
    requireOrdered(changes, (entry) => {
      const preferred = (entry.after ?? entry.before) as Record<
        string,
        unknown
      >;
      return `${preferred.route}:${entry.kind}:${preferred.id}`;
    });
    const routes = new Set<string>();
    for (const change of changes) {
      const preferred = (change.after ?? change.before) as Record<
        string,
        unknown
      >;
      if (routes.has(String(preferred.route)))
        reviewInvalid("duplicate routed Changes entry");
      routes.add(String(preferred.route));
      if (change.kind === "use-case") continue;
      const record =
        change.kind === "screen"
          ? screens.find((screen) => screen.route === preferred.route)
          : components.find((component) => component.id === preferred.id);
      if (!record) reviewInvalid("changed entry has no result record");
      requireEqual(
        { before: record.before, after: record.after },
        { before: change.before, after: change.after },
      );
    }
    const affected = reviewArray(result.affectedConsumers).map(
      validateAffected,
    );
    requireOrdered(affected, (item) => {
      const consumer = item.consumer as Record<string, unknown>;
      return `${item.changedComponentId}:${consumer.kind}:${consumer.route ?? consumer.id}`;
    });
    validateResultReferences(value as ReviewResultV3);
  }
  return value as ReviewResult;
}
function validateResultReferences(result: ReviewResultV3): void {
  const changed = new Set(
    result.changes
      .filter((entry) => entry.kind === "component")
      .map((entry) => (entry.after ?? entry.before)!.id),
  );
  for (const affected of result.affectedConsumers) {
    if (!changed.has(affected.changedComponentId))
      reviewInvalid("affected evidence has no directly changed component");
    for (const evidence of affected.evidence) {
      const context = evidence.context;
      const owner =
        context.kind === "screen"
          ? result.screens.find(
              (screen) => screen.route === context.entry.route,
            )
          : result.components.find(
              (component) => component.id === context.entry.id,
            );
      if (!owner?.[evidence.side])
        reviewInvalid("affected context side is missing");
      requireEqual(owner[evidence.side], context.entry);
      const views =
        context.kind === "screen" && "views" in owner
          ? owner.views
          : "variants" in owner && context.kind === "component"
            ? owner.variants.find((variant) => variant.id === context.variantId)
                ?.views
            : undefined;
      if (
        !views?.some(
          (view) =>
            view.viewport === context.viewport &&
            view.colorScheme === context.colorScheme &&
            view[`${evidence.side}Path`],
        )
      )
        reviewInvalid("affected context view is missing");
      if (
        evidence.via.some(
          (edge) =>
            !result.components.some(
              (component) => component.id === edge.componentId,
            ),
        )
      )
        reviewInvalid("unknown component in ownership chain");
      if (
        affected.consumer.kind === "screen"
          ? context.kind !== "screen" ||
            affected.consumer.route !== context.entry.route
          : affected.consumer.id === affected.changedComponentId ||
            (affected.consumer.id !== context.entry.id &&
              !evidence.via
                .slice(0, -1)
                .some(
                  (edge) =>
                    edge.componentId ===
                    (affected.consumer as { id: string }).id,
                ))
      )
        reviewInvalid("affected consumer does not own this chain");
    }
  }
  for (const entry of result.changes)
    for (const reason of entry.reasons)
      if (
        reason.kind === "screen" &&
        !result.changes.some(
          (screen) =>
            screen.kind === "screen" &&
            [screen.before?.route, screen.after?.route].includes(reason.route),
        )
      )
        reviewInvalid("use-case reason names a screen without a direct change");
  const ignored = new Map<string, number>();
  for (const screen of result.screens)
    for (const view of screen.views)
      for (const id of view.ignoredIds) {
        const key = canonicalJson([view.viewport, view.colorScheme, id]);
        ignored.set(key, (ignored.get(key) ?? 0) + 1);
      }
  if (
    result.ignoredImpact.length !== ignored.size ||
    result.ignoredImpact.some(
      (item) =>
        ignored.get(
          canonicalJson([item.viewport, item.colorScheme, item.id]),
        ) !== item.count,
    )
  )
    reviewInvalid("ignored impact does not match view evidence");
}

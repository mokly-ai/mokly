import { canonicalJson } from "../components/data.js";

import type { ReviewResultV5 } from "./component_types.js";
import { affectedConsumerOrderKey } from "./order.js";
import {
  requireEqual,
  requireOrdered,
  reviewArray,
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

/** Decode the identity-only v4 result shared by every catalogue. */
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
    value.schemaVersion !== 5
  )
    reviewInvalid("unsupported schemaVersion");
  const result = reviewObject(value, [
    "schemaVersion",
    "baseCommit",
    "baseRef",
    "changedPaths",
    "ignoredImpact",
    "screens",
    "components",
    "changes",
    "affectedConsumers",
  ]);
  if (!/^[a-f0-9]{40,64}$/.test(reviewString(result.baseCommit)))
    reviewInvalid("invalid base commit");
  reviewString(result.baseRef);
  const changed = reviewStrings(result.changedPaths, reviewPath);
  const screens = reviewArray(result.screens).map((screen) =>
    validateReviewScreen(screen, false, changed),
  );
  requireOrdered(screens, (screen) => String(screen.id));
  const components = reviewArray(result.components).map((component) =>
    validateReviewScreen(component, true, changed),
  );
  requireOrdered(components, (component) => String(component.id));
  const changes = reviewArray(result.changes).map((entry) =>
    validateChangedEntry(entry, changed),
  );
  requireOrdered(changes, (change) => {
    const preferred = (change.after ?? change.before) as Record<
      string,
      unknown
    >;
    return `${String(change.kind)}\u0000${String(preferred.id)}`;
  });
  const changeIds = new Set<string>();
  for (const change of changes) {
    const preferred = (change.after ?? change.before) as Record<
      string,
      unknown
    >;
    const id = String(preferred.id);
    if (changeIds.has(id)) reviewInvalid("duplicate Changes entry id");
    changeIds.add(id);
    if (change.kind === "use-case") continue;
    const record =
      change.kind === "screen"
        ? screens.find((screen) => screen.id === id)
        : components.find((component) => component.id === id);
    const variant =
      change.kind === "component" && !record
        ? components
            .flatMap(
              (component) => component.variants as Record<string, unknown>[],
            )
            .find((candidate) => candidate.id === id)
        : undefined;
    if (!record && !variant)
      reviewInvalid("changed entry has no result record");
    if (record)
      requireEqual(
        { before: record.before, after: record.after },
        { before: change.before, after: change.after },
      );
    if (variant && (variant.title !== preferred.title || variant.id !== id))
      reviewInvalid("changed variant address differs from its result");
  }
  const affected = reviewArray(result.affectedConsumers).map(validateAffected);
  requireOrdered(affected, (item) =>
    affectedConsumerOrderKey(
      item as unknown as ReviewResultV5["affectedConsumers"][number],
    ),
  );
  validateIgnoredImpact(result.ignoredImpact, screens);
  validateResultReferences(value as ReviewResultV5);
  return value as ReviewResult;
}

function validateIgnoredImpact(
  value: unknown,
  screens: readonly Record<string, unknown>[],
): void {
  const ignoredKeys: string[] = [];
  for (const raw of reviewArray(value)) {
    const impact = reviewObject(raw, [
      "viewport",
      "colorScheme",
      "id",
      "count",
    ]);
    reviewString(impact.id);
    if (
      !["mobile", "desktop"].includes(String(impact.viewport)) ||
      !["light", "dark"].includes(String(impact.colorScheme)) ||
      !Number.isSafeInteger(impact.count) ||
      Number(impact.count) < 1
    )
      reviewInvalid("invalid ignored impact");
    ignoredKeys.push(
      `${impact.viewport === "mobile" ? 0 : 1}\u0000${impact.colorScheme === "light" ? 0 : 1}\u0000${impact.id}`,
    );
  }
  requireOrdered(ignoredKeys, (key) => key);
  const ignored = new Map<string, number>();
  for (const screen of screens)
    for (const view of screen.views as Record<string, unknown>[])
      for (const id of view.ignoredIds as string[]) {
        const key = canonicalJson([view.viewport, view.colorScheme, id]);
        ignored.set(key, (ignored.get(key) ?? 0) + 1);
      }
  if (
    reviewArray(value).length !== ignored.size ||
    reviewArray(value).some((raw) => {
      const item = raw as Record<string, unknown>;
      return (
        ignored.get(
          canonicalJson([item.viewport, item.colorScheme, item.id]),
        ) !== item.count
      );
    })
  )
    reviewInvalid("ignored impact does not match view evidence");
}

function validateResultReferences(result: ReviewResultV5): void {
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
          ? result.screens.find((screen) => screen.id === context.entry.id)
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
            (view.state !== "added" || evidence.side === "after") &&
            (view.state !== "removed" || evidence.side === "before"),
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
            affected.consumer.id !== context.entry.id
          : affected.consumer.id === affected.changedComponentId ||
            (affected.consumer.id !== context.entry.id &&
              !evidence.via
                .slice(0, -1)
                .some((edge) => edge.componentId === affected.consumer.id))
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
            [screen.before?.id, screen.after?.id].includes(reason.id),
        )
      )
        reviewInvalid("use-case reason names a screen without a direct change");
}

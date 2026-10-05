import { canonicalJson } from "../components/data.js";

import type { ReviewResultV6 } from "./component_types.js";
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
import { validateResultMoves } from "./result_moves.js";
import {
  validateAffected,
  validateChangedEntry,
  validateReviewScreen,
} from "./result_records.js";
import { validateResultReferences } from "./result_references.js";
import type { ReviewResult } from "./types.js";

/** Decode the path-addressed v5 result shared by every catalogue. */
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
    value.schemaVersion !== 6
  )
    reviewInvalid("unsupported schemaVersion");
  const result = reviewObject(value, [
    "schemaVersion",
    "baseCommit",
    "baseRef",
    "changedPaths",
    "ignoredImpact",
    "screens",
    "sharedImpact",
    "components",
    "changes",
    "affectedConsumers",
  ]);
  if (!/^[a-f0-9]{40,64}$/.test(reviewString(result.baseCommit)))
    reviewInvalid("invalid base commit");
  reviewString(result.baseRef);
  const changed = reviewStrings(result.changedPaths, reviewPath);
  reviewStrings(result.sharedImpact, reviewPath);
  const screens = reviewArray(result.screens).map((screen) =>
    validateReviewScreen(screen, false, changed),
  );
  requireOrdered(screens, (screen) => String(screen.path));
  const components = reviewArray(result.components).map((component) =>
    validateReviewScreen(component, true, changed),
  );
  requireOrdered(components, (component) => String(component.path));
  const changes = reviewArray(result.changes).map((entry) =>
    validateChangedEntry(entry, changed),
  );
  requireOrdered(changes, (change) => {
    const preferred = (change.after ?? change.before) as Record<
      string,
      unknown
    >;
    return `${String(change.kind)}\u0000${String(preferred.path)}`;
  });
  const changeIds = new Set<string>();
  for (const change of changes) {
    const preferred = (change.after ?? change.before) as Record<
      string,
      unknown
    >;
    const id = String(preferred.path);
    if (changeIds.has(id)) reviewInvalid("duplicate Changes entry path");
    changeIds.add(id);
    if (change.kind === "use-case") continue;
    const record =
      change.kind === "screen"
        ? screens.find((screen) => screen.path === id)
        : components.find((component) => component.path === id);
    const variant =
      change.kind === "component" && !record
        ? components
            .flatMap(
              (component) => component.variants as Record<string, unknown>[],
            )
            .find((candidate) => candidate.path === id)
        : undefined;
    if (!record && !variant)
      reviewInvalid("changed entry has no result record");
    if (record)
      requireEqual(
        {
          before: record.before,
          after: record.after,
          previousPath: record.previousPath,
        },
        {
          before: change.before,
          after: change.after,
          previousPath: change.previousPath,
        },
      );
    if (variant && (variant.title !== preferred.title || variant.path !== id))
      reviewInvalid("changed variant address differs from its result");
    if (variant)
      requireEqual(
        { previousPath: variant.previousPath },
        { previousPath: change.previousPath },
      );
  }
  const affected = reviewArray(result.affectedConsumers).map(validateAffected);
  requireOrdered(affected, (item) =>
    affectedConsumerOrderKey(
      item as unknown as ReviewResultV6["affectedConsumers"][number],
    ),
  );
  validateIgnoredImpact(result.ignoredImpact, screens);
  validateResultReferences(value as ReviewResultV6);
  validateResultMoves(value as ReviewResultV6);
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

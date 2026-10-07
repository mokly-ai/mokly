import assert from "node:assert/strict";

import { generatedViews } from "../../packages/viewer/dist/components/views.js";
import type {
  ChangedEntry,
  EntryChangeReason,
  Manifest,
  ReviewResultV6,
} from "../../packages/viewer/dist/data.js";

/** Sorted change paths, retaining duplicates so exact assertions reject them. */
export function changedEntryPaths(result: ReviewResultV6): string[] {
  return result.changes.map(changePath).sort();
}

/** Exact reasons for an entry; missing or duplicate entries fail the test. */
export function reasonsOf(
  result: ReviewResultV6,
  path: string,
): readonly EntryChangeReason[] {
  const changes = result.changes.filter(
    (change) => changePath(change) === path,
  );
  assert.equal(changes.length, 1, `Expected one changed entry for ${path}`);
  const [change] = changes;
  assert.ok(change);
  return change.reasons;
}

/** Sorted component identities that actually affect at least one consumer. */
export function impactingIds(result: ReviewResultV6): string[] {
  return [
    ...new Set(result.affectedConsumers.map((item) => item.changedComponentId)),
  ].sort();
}

/** Sorted screen consumers for one changed component, never another owner. */
export function screenConsumersOf(
  result: ReviewResultV6,
  changedComponentId: string,
): string[] {
  return result.affectedConsumers
    .flatMap((item) =>
      item.changedComponentId === changedComponentId &&
      item.consumer.kind === "screen"
        ? [item.consumer.path]
        : [],
    )
    .sort();
}

/** Saved variants of a named component consumer for one changed component. */
export function usageVariantsOf(
  result: ReviewResultV6,
  changedComponentId: string,
  consumerPath: string,
): string[] {
  const variants = result.affectedConsumers.flatMap((item) =>
    item.changedComponentId === changedComponentId &&
    item.consumer.kind === "component" &&
    item.consumer.path === consumerPath
      ? item.evidence.flatMap(({ context }) =>
          context.kind === "component" && context.entry.path === consumerPath
            ? [context.variantPath]
            : [],
        )
      : [],
  );
  return [...new Set(variants)].sort();
}

/** Unique component-id chains for one changed component and named consumer. */
export function usageChainsOf(
  result: ReviewResultV6,
  changedComponentId: string,
  consumerPath: string,
): string[][] {
  const chains = result.affectedConsumers.flatMap((item) =>
    item.changedComponentId === changedComponentId &&
    item.consumer.path === consumerPath
      ? item.evidence.map(({ via }) =>
          via.map(({ componentId }) => componentId),
        )
      : [],
  );
  const unique = new Map(chains.map((chain) => [JSON.stringify(chain), chain]));
  return [...unique]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, chain]) => chain);
}

/** Sorted entries whose dependency reasons name this exact stylesheet path. */
export function stylesheetScope(
  result: ReviewResultV6,
  stylesheetPath: string,
): string[] {
  return result.changes
    .filter((change) =>
      change.reasons.some(
        (reason) =>
          reason.kind === "dependency" && reason.path === stylesheetPath,
      ),
    )
    .map(changePath)
    .sort();
}

/** Real screen consumers across all rendered views of the supplied manifest. */
export function manifestScreenConsumers(
  manifest: Manifest,
  componentId: string,
): string[] {
  return manifest.entries
    .flatMap((entry) =>
      entry.kind === "screen" &&
      generatedViews(entry).some((view) =>
        view.usage?.instances.some(
          (instance) => instance.componentId === componentId,
        ),
      )
        ? [entry.path]
        : [],
    )
    .sort();
}

function changePath(change: ChangedEntry): string {
  const entry = change.after ?? change.before;
  assert.ok(entry, "A changed entry must have a before or after side");
  return entry.path;
}

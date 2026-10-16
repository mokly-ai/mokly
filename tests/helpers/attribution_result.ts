import assert from "node:assert/strict";

import { generatedViews } from "../../packages/viewer/dist/components/views.js";
import type { Manifest } from "../../packages/viewer/dist/registry/types.js";
import type {
  EntryChangeReason,
  ReviewEntry,
  ReviewResult,
} from "../../packages/viewer/dist/review/types.js";

/** Every entry record, each component parent followed by its variants. */
function records(result: ReviewResult): ReviewEntry[] {
  return result.entries.flatMap((entry) => [entry, ...(entry.variants ?? [])]);
}

/** Sorted included paths, retaining duplicates so exact assertions reject them. */
export function changedEntryPaths(result: ReviewResult): string[] {
  return records(result)
    .filter((entry) => entry.included)
    .map(changePath)
    .sort();
}

/** Exact reasons for an entry; missing or duplicate entries fail the test. */
export function reasonsOf(
  result: ReviewResult,
  path: string,
): readonly EntryChangeReason[] {
  const changes = records(result).filter(
    (entry) => entry.included && changePath(entry) === path,
  );
  assert.equal(changes.length, 1, `Expected one changed entry for ${path}`);
  const [change] = changes;
  assert.ok(change);
  return change.reasons;
}

/** Sorted component identities that actually affect at least one consumer. */
export function impactingIds(result: ReviewResult): string[] {
  return [
    ...new Set(result.affected.map((item) => item.changedComponentId)),
  ].sort();
}

/** Sorted screen consumers for one changed component, never another owner. */
export function screenConsumersOf(
  result: ReviewResult,
  changedComponentId: string,
): string[] {
  return result.affected
    .flatMap((item) =>
      item.changedComponentId === changedComponentId &&
      item.consumer.kind === "screen"
        ? [item.consumer.path]
        : [],
    )
    .sort();
}

/**
 * The views of a named component consumer, its own or its saved variants',
 * whose usage shows one changed component.
 */
export function usageVariantsOf(
  result: ReviewResult,
  changedComponentId: string,
  consumerPath: string,
): string[] {
  const parent = result.entries.find(
    (entry) => entry.kind === "component" && entry.path === consumerPath,
  );
  const own = new Set([
    consumerPath,
    ...(parent?.variants ?? []).map((variant) => variant.path),
  ]);
  const variants = result.affected.flatMap((item) =>
    item.changedComponentId === changedComponentId &&
    item.consumer.kind === "component" &&
    item.consumer.path === consumerPath
      ? item.evidence.flatMap(({ context }) =>
          context.kind === "component" && own.has(context.entry.path)
            ? [context.entry.path]
            : [],
        )
      : [],
  );
  return [...new Set(variants)].sort();
}

/** Unique component-id chains for one changed component and named consumer. */
export function usageChainsOf(
  result: ReviewResult,
  changedComponentId: string,
  consumerPath: string,
): string[][] {
  const chains = result.affected.flatMap((item) =>
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

/** Sorted included entries whose dependency reasons name this exact route. */
export function stylesheetScope(
  result: ReviewResult,
  stylesheetPath: string,
): string[] {
  return records(result)
    .filter(
      (entry) =>
        entry.included &&
        entry.reasons.some(
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

function changePath(entry: ReviewEntry): string {
  assert.ok(
    entry.after ?? entry.before,
    "A changed entry must have a before or after side",
  );
  return entry.path;
}

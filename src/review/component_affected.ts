import {
  affectedConsumerOrderKey,
  canonicalJson,
  isManifestComponentVariant,
} from "@mokly/viewer/data";
import type {
  Manifest,
  AffectedConsumer,
  AffectedUsageEvidence,
  ComponentUsageContext,
} from "@mokly/viewer/data";

import { address, lexical } from "./component_metadata.js";
import { baselinePathMapper } from "./moves/identity.js";
import type { EntryMove } from "./moves/types.js";
import { reviewViews } from "./views.js";

/** Derive consumer chains from input ownership, including slots and removed occurrences. */
export function affectedConsumers(
  before: Manifest,
  after: Manifest,
  changed: ReadonlySet<string>,
  moves: readonly EntryMove[] = [],
): AffectedConsumer[] {
  const mapBefore = baselinePathMapper(before.entries, after.entries, moves);
  const groups = new Map<
    string,
    { record: AffectedConsumer; evidence: Map<string, AffectedUsageEvidence> }
  >();
  for (const side of ["before", "after"] as const) {
    const manifest = side === "before" ? before : after;
    const canonical = side === "before" ? mapBefore : (path: string) => path;
    for (const entry of manifest.entries) {
      if (entry.kind !== "screen" && entry.kind !== "component") continue;
      const contextEntry =
        entry.kind === "component" && isManifestComponentVariant(entry)
          ? manifest.entries.find(
              (candidate) =>
                candidate.kind === "component" &&
                !isManifestComponentVariant(candidate) &&
                candidate.path === entry.variantOf,
            )
          : entry;
      if (
        !contextEntry ||
        (contextEntry.kind !== "screen" && contextEntry.kind !== "component")
      )
        continue;
      for (const view of reviewViews(entry)) {
        if (!view.usage) continue;
        const context: ComponentUsageContext =
          entry.kind === "screen"
            ? {
                kind: "screen",
                entry: address(entry),
                viewport: view.viewport,
                colorScheme: view.colorScheme,
              }
            : {
                kind: "component",
                entry: address(contextEntry),
                variantPath: entry.path,
                viewport: view.viewport,
                colorScheme: view.colorScheme,
              };
        const instances = new Map(
          view.usage.instances.map((instance) => [instance.key, instance]),
        );
        for (const instance of view.usage.instances) {
          const changedComponentId = canonical(instance.componentId);
          if (!changed.has(changedComponentId)) continue;
          const via: { componentId: string; instanceKey: string }[] = [];
          let next: typeof instance | undefined = instance;
          while (next) {
            via.unshift({
              componentId: next.componentId,
              instanceKey: next.key,
            });
            next =
              next.owner.kind === "instance"
                ? instances.get(next.owner.instanceKey)
                : undefined;
          }
          const consumers: AffectedConsumer["consumer"][] = [
            entry.kind === "screen"
              ? { kind: "screen", path: canonical(entry.path) }
              : { kind: "component", path: canonical(contextEntry.path) },
            ...via.slice(0, -1).map((ancestor) => ({
              kind: "component" as const,
              path: canonical(ancestor.componentId),
            })),
          ];
          const evidence: AffectedUsageEvidence = { side, context, via };
          for (const consumer of consumers) {
            if (
              consumer.kind === "component" &&
              consumer.path === changedComponentId
            )
              continue;
            const key = affectedConsumerOrderKey({
              changedComponentId,
              consumer,
            });
            let group = groups.get(key);
            if (!group) {
              group = {
                record: {
                  changedComponentId,
                  consumer,
                  evidence: [],
                },
                evidence: new Map(),
              };
              groups.set(key, group);
            }
            group.evidence.set(canonicalJson(evidence), evidence);
          }
        }
      }
    }
  }
  return [...groups]
    .sort(([a], [b]) => lexical(a, b))
    .map(([, group]) => ({
      ...group.record,
      evidence: [...group.evidence.values()].sort(compareEvidence),
    }));
}
function compareEvidence(
  a: AffectedUsageEvidence,
  b: AffectedUsageEvidence,
): number {
  const variant = (item: AffectedUsageEvidence) =>
    item.context.kind === "component" ? item.context.variantPath : "";
  return (
    (a.side === "before" ? 0 : 1) - (b.side === "before" ? 0 : 1) ||
    lexical(a.context.entry.path, b.context.entry.path) ||
    lexical(variant(a), variant(b)) ||
    (a.context.viewport === "mobile" ? 0 : 1) -
      (b.context.viewport === "mobile" ? 0 : 1) ||
    (a.context.colorScheme === "light" ? 0 : 1) -
      (b.context.colorScheme === "light" ? 0 : 1) ||
    lexical(canonicalJson(a.via), canonicalJson(b.via))
  );
}

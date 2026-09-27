import {
  canonicalJson,
  generatedViews,
  isManifestComponentVariant,
} from "@mokly/viewer/data";
import type {
  Manifest,
  AffectedConsumer,
  AffectedUsageEvidence,
  ComponentUsageContext,
} from "@mokly/viewer/data";

import { address, lexical } from "./component_metadata.js";

/** Derive consumer chains from input ownership, including slots and removed occurrences. */
export function affectedConsumers(
  before: Manifest,
  after: Manifest,
  changed: ReadonlySet<string>,
): AffectedConsumer[] {
  const groups = new Map<
    string,
    { record: AffectedConsumer; evidence: Map<string, AffectedUsageEvidence> }
  >();
  for (const side of ["before", "after"] as const) {
    const manifest = side === "before" ? before : after;
    for (const entry of manifest.entries) {
      if (entry.kind !== "screen" && entry.kind !== "component") continue;
      const contextEntry =
        entry.kind === "component" && isManifestComponentVariant(entry)
          ? manifest.entries.find(
              (candidate) =>
                candidate.kind === "component" &&
                !isManifestComponentVariant(candidate) &&
                candidate.id === entry.variantOf,
            )
          : entry;
      if (
        !contextEntry ||
        (contextEntry.kind !== "screen" && contextEntry.kind !== "component")
      )
        continue;
      for (const view of generatedViews(entry)) {
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
                variantId: entry.id,
                viewport: view.viewport,
                colorScheme: view.colorScheme,
              };
        const instances = new Map(
          view.usage.instances.map((instance) => [instance.key, instance]),
        );
        for (const instance of view.usage.instances) {
          if (!changed.has(instance.componentId)) continue;
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
              ? { kind: "screen", id: entry.id }
              : { kind: "component", id: contextEntry.id },
            ...via.slice(0, -1).map((ancestor) => ({
              kind: "component" as const,
              id: ancestor.componentId,
            })),
          ];
          const evidence: AffectedUsageEvidence = { side, context, via };
          for (const consumer of consumers) {
            if (
              consumer.kind === "component" &&
              consumer.id === instance.componentId
            )
              continue;
            const key = `${instance.componentId}:${consumer.kind}:${consumer.id}`;
            let group = groups.get(key);
            if (!group) {
              group = {
                record: {
                  changedComponentId: instance.componentId,
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
export function compareEvidence(
  a: AffectedUsageEvidence,
  b: AffectedUsageEvidence,
): number {
  const variant = (item: AffectedUsageEvidence) =>
    item.context.kind === "component" ? item.context.variantId : "";
  return (
    (a.side === "before" ? 0 : 1) - (b.side === "before" ? 0 : 1) ||
    lexical(a.context.entry.id, b.context.entry.id) ||
    lexical(variant(a), variant(b)) ||
    (a.context.viewport === "mobile" ? 0 : 1) -
      (b.context.viewport === "mobile" ? 0 : 1) ||
    (a.context.colorScheme === "light" ? 0 : 1) -
      (b.context.colorScheme === "light" ? 0 : 1) ||
    lexical(canonicalJson(a.via), canonicalJson(b.via))
  );
}

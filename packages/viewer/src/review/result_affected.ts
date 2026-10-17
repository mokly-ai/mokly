/**
 * The review-local references of the affected-consumer records. They
 * complement the producer's proof of actual instance ownership: each record
 * names an included component with render, resource, or style impact, a
 * listed consumer, and evidence whose side, view, and chain resolve.
 */

import type { ConsumerKind } from "../generated/catalogue/ConsumerKind.js";

import { flattenEntries } from "./result_entries.js";
import { asciiLower, requireEqual, reviewInvalid } from "./result_helpers.js";
import type {
  AffectedConsumer,
  ReviewEntry,
  ReviewEntryAddress,
} from "./types.js";

const IMPACT = new Set([
  "added",
  "removed",
  "material",
  "implementation",
  "dependency",
]);

interface Side {
  entry: ReviewEntry;
  address: ReviewEntryAddress;
}

/** Validate every affected record against the entries of the same result. */
export function validateAffected(
  entries: readonly ReviewEntry[],
  affected: readonly AffectedConsumer[],
): void {
  const flat = flattenEntries(entries);
  const current = new Set<string>();
  const sides = new Map<string, Side>();
  const beforeComponents = new Map<string, string>();
  const impact = new Set<string>();
  for (const { entry, owner } of flat) {
    if (entry.kind === "use-case") continue;
    current.add(`${entry.kind}\u0000${entry.path}`);
    for (const side of ["before", "after"] as const) {
      const address = entry[side];
      if (!address) continue;
      sides.set(`${side}\u0000${entry.kind}\u0000${address.path}`, {
        entry,
        address,
      });
      if (side === "before" && entry.kind === "component")
        beforeComponents.set(asciiLower(address.path), entry.path);
    }
    if (
      entry.kind === "component" &&
      entry.included &&
      entry.reasons.some((reason) => IMPACT.has(reason.kind))
    )
      impact.add(owner);
  }
  for (const record of affected) validateRecord(record);

  function validateRecord(record: AffectedConsumer): void {
    const consumer: ConsumerKind = record.consumer.kind;
    if (
      (consumer === "component" &&
        record.consumer.path === record.changedComponentId) ||
      !current.has(`${consumer}\u0000${record.consumer.path}`)
    )
      reviewInvalid("an affected consumer must be another listed entry");
    if (!impact.has(record.changedComponentId))
      reviewInvalid("affected evidence needs an included component impact");
    for (const evidence of record.evidence) {
      const context = sides.get(
        `${evidence.side}\u0000${evidence.context.kind}\u0000${evidence.context.entry.path}`,
      );
      if (!context) reviewInvalid("affected context side is missing");
      requireEqual(context.address, evidence.context.entry);
      if (
        !context.entry.views.some(
          (view) =>
            view.viewport === evidence.context.viewport &&
            view.colorScheme === evidence.context.colorScheme &&
            (evidence.side === "before"
              ? view.state !== "added"
              : view.state !== "removed"),
        )
      )
        reviewInvalid("affected context view is missing");
      const last = evidence.via.at(-1)!.componentId;
      const resolved =
        evidence.side === "before"
          ? beforeComponents.get(asciiLower(last))
          : last;
      if (resolved !== record.changedComponentId)
        reviewInvalid("an ownership chain must end at the changed component");
      if (
        new Set(evidence.via.map((edge) => edge.instanceKey)).size !==
        evidence.via.length
      )
        reviewInvalid("an ownership chain repeats an instance");
    }
  }
}

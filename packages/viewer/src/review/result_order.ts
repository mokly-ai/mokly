/**
 * The canonical array order of review result v8, shared with the producer:
 * the reader requires it as written and rejects duplicates instead of
 * reordering. String parts compare by UTF-16 code units; enum parts follow
 * their declaration order.
 */

import { canonicalJson } from "../components/data.js";
import type { EvidenceOwner } from "../generated/catalogue/EvidenceOwner.js";
import type { ResourceEvidence } from "../generated/catalogue/ResourceEvidence.js";
import type { RuleEvidence } from "../generated/catalogue/RuleEvidence.js";

import { requireOrdered } from "./result_helpers.js";
import type {
  AffectedConsumer,
  AffectedUsageEvidence,
  EntryChangeReason,
  ReviewEntry,
  ReviewView,
} from "./types.js";

const SEPARATOR = "\u0000";
const RANK: Readonly<Record<string, string>> = {
  component: "0",
  screen: "1",
  "use-case": "2",
  mobile: "0",
  desktop: "1",
  light: "0",
  dark: "1",
  before: "0",
  after: "1",
};

const key = (...parts: readonly string[]) => parts.join(SEPARATOR);
const owner = (value: EvidenceOwner) =>
  value.kind === "entry" ? key("entry", "") : key("component", value.path);

/** Lexical reason kind, then its explicit target. */
function reasonKey(reason: EntryChangeReason): string {
  return key(
    reason.kind,
    reason.kind === "dependency"
      ? reason.path
      : reason.kind === "screen"
        ? reason.screenPath
        : "",
  );
}

function ruleKey(rule: RuleEvidence): string {
  return key(rule.stylesheet, rule.selector, rule.status, owner(rule.owner));
}

function resourceKey(resource: ResourceEvidence): string {
  return key(resource.path, owner(resource.owner));
}

function viewKey(view: ReviewView): string {
  return key(RANK[view.viewport]!, RANK[view.colorScheme]!);
}

/** The affected-consumer order key. */
function affectedKey(affected: AffectedConsumer): string {
  return key(
    affected.changedComponentId,
    RANK[affected.consumer.kind]!,
    affected.consumer.path,
  );
}

function usageKey(evidence: AffectedUsageEvidence): string {
  return key(
    RANK[evidence.side]!,
    RANK[evidence.context.kind]!,
    evidence.context.entry.path,
    RANK[evidence.context.viewport]!,
    RANK[evidence.context.colorScheme]!,
    canonicalJson(evidence.via),
  );
}

/** Entries by kind, then path; each record's own lists in their stated order. */
export function requireCanonicalEntries(entries: readonly ReviewEntry[]): void {
  requireOrdered(entries, (entry) => key(RANK[entry.kind]!, entry.path));
  for (const entry of entries) requireEntryOrder(entry);
}

function requireEntryOrder(entry: ReviewEntry): void {
  requireOrdered(entry.views, viewKey);
  requireOrdered(entry.reasons, reasonKey);
  for (const view of entry.views) {
    requireOrdered(view.ignoredIds, (id) => id);
    requireOrdered(view.rules ?? [], ruleKey);
    requireOrdered(view.resources ?? [], resourceKey);
  }
  for (const variant of entry.variants ?? []) requireEntryOrder(variant);
}

export function requireCanonicalAffected(
  affected: readonly AffectedConsumer[],
): void {
  requireOrdered(affected, affectedKey);
  for (const item of affected) requireOrdered(item.evidence, usageKey);
}

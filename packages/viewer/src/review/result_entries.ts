/**
 * The entry rules of review result v8: sides, membership, the state
 * aggregate, reasons with their proving evidence, and the evidence records
 * of each view. The producer separately proves source coverage.
 */

import type { EvidenceOwner } from "../generated/catalogue/EvidenceOwner.js";

import { asciiLower, requireEqual, reviewInvalid } from "./result_helpers.js";
import type { ReviewEntry, ReviewState, ReviewView } from "./types.js";

const PRECEDENCE: readonly ReviewState[] = [
  "unchanged",
  "ignored-only",
  "removed",
  "added",
  "changed",
];

/** The entry state over its views: changed, added, removed, ignored-only, unchanged. */
function aggregateState(views: readonly ReviewView[]): ReviewState {
  return views.reduce<ReviewState>(
    (state, view) =>
      PRECEDENCE.indexOf(view.state) > PRECEDENCE.indexOf(state)
        ? view.state
        : state,
    "unchanged",
  );
}

/** Every entry and variant with the parent path that owns its evidence. */
export function flattenEntries(
  entries: readonly ReviewEntry[],
): readonly { entry: ReviewEntry; owner: string }[] {
  return entries.flatMap((entry) => [
    { entry, owner: entry.path },
    ...(entry.variants ?? []).map((variant) => ({
      entry: variant,
      owner: entry.path,
    })),
  ]);
}

/** Validate one entry or variant whose component evidence `owner` names. */
export function validateEntry(entry: ReviewEntry, owner: string): void {
  validateSides(entry);
  if (entry.included !== (entry.reasons.length > 0 || !!entry.previousPath))
    reviewInvalid("membership differs from the reasons");
  if (entry.kind === "use-case" ? entry.views.length > 0 : !entry.views.length)
    reviewInvalid("a use case has no views; another entry has some");
  if (
    entry.before &&
    entry.after &&
    entry.state !== aggregateState(entry.views)
  )
    reviewInvalid("the entry state differs from its views");
  for (const reason of entry.reasons) validateReason(entry, owner, reason);
  for (const view of entry.views) validateView(entry, view);
  validateVariantOrder(entry);
}

function validateSides(entry: ReviewEntry): void {
  const address = entry.after ?? entry.before;
  if (!address) reviewInvalid("at least one side is required");
  requireEqual(
    { path: entry.path, title: entry.title },
    { path: address.path, title: address.title },
  );
  if (!entry.before && entry.state !== "added")
    reviewInvalid("an entry without a before side is added");
  if (!entry.after && entry.state !== "removed")
    reviewInvalid("an entry without a current side is removed");
  const moved =
    !!entry.before &&
    !!entry.after &&
    asciiLower(entry.before.path) !== asciiLower(entry.after.path);
  if (moved !== (entry.previousPath !== undefined))
    reviewInvalid("previousPath is present exactly on a paired move");
  if (moved && entry.previousPath !== entry.before!.path)
    reviewInvalid("previousPath must match the before side");
}

function validateReason(
  entry: ReviewEntry,
  owner: string,
  reason: ReviewEntry["reasons"][number],
): void {
  if (
    (reason.kind === "added" && entry.before) ||
    (reason.kind === "removed" && entry.after)
  )
    reviewInvalid("reason conflicts with available sides");
  if (reason.kind === "screen" && entry.kind !== "use-case")
    reviewInvalid("screen propagation requires a use case");
  if (
    reason.kind === "implementation" &&
    (entry.kind !== "component" || entry.path !== owner)
  )
    reviewInvalid("implementation impact belongs to a component parent");
  if (reason.kind !== "dependency") return;
  const external =
    entry.kind === "component" &&
    entry.path === owner &&
    !reason.path.endsWith(".css");
  const own = entry.views.some(
    (view) =>
      (view.rules ?? []).some(
        (rule) =>
          rule.stylesheet === reason.path &&
          rule.status !== "excluded" &&
          owned(rule.owner, owner),
      ) ||
      (view.resources ?? []).some(
        (resource) =>
          resource.path === reason.path && owned(resource.owner, owner),
      ),
  );
  if (!external && !own)
    reviewInvalid("a dependency reason needs its owned evidence");
}

function owned(evidenceOwner: EvidenceOwner, owner: string): boolean {
  return (
    evidenceOwner.kind === "entry" ||
    (evidenceOwner.kind === "component" && evidenceOwner.path === owner)
  );
}

function validateView(entry: ReviewEntry, view: ReviewView): void {
  if (
    (view.state === "added" && !entry.after) ||
    (view.state === "removed" && !entry.before)
  )
    reviewInvalid("a view state needs its entry side");
  const rules = view.rules ?? [];
  for (const rule of rules) {
    if (rule.status === "unresolved" && rule.owner.kind !== "entry")
      reviewInvalid("an unresolved rule has the entry owner");
    if (
      rule.status === "excluded" &&
      (rule.selector !== "" ||
        rule.owner.kind !== "entry" ||
        rules.some(
          (other) =>
            other.stylesheet === rule.stylesheet && other.status !== "excluded",
        ))
    )
      reviewInvalid("an excluded stylesheet has one entry record");
    if (
      (view.state === "unchanged" || view.state === "ignored-only") &&
      rule.status !== "excluded" &&
      rule.owner.kind === "entry"
    )
      reviewInvalid("an unchanged view keeps no entry-owned rule");
  }
}

/** Current variants come before the variants only the base has. */
function validateVariantOrder(entry: ReviewEntry): void {
  let baseOnly = false;
  for (const variant of entry.variants ?? []) {
    if (!variant.after) baseOnly = true;
    else if (baseOnly)
      reviewInvalid("current variants come before base-only variants");
  }
}

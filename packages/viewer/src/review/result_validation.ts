/**
 * The strict path-keyed reader of review result v8. It checks the version
 * before any other field, then the record shapes, the canonical order, the
 * entry rules, and the affected references, and it never reorders input.
 */

import { MoklyVersionError } from "../catalogue/version_error.js";

import { validateAffected } from "./result_affected.js";
import { flattenEntries, validateEntry } from "./result_entries.js";
import {
  asciiLower,
  reviewArray,
  reviewCommit,
  reviewInvalid,
  reviewObject,
} from "./result_helpers.js";
import {
  requireCanonicalAffected,
  requireCanonicalEntries,
} from "./result_order.js";
import { readAffected, readDiagnostic, readEntry } from "./result_records.js";
import type { ReviewResult } from "./types.js";

/** Decode one review result v8 that every catalogue and route shares. */
export function parseReviewResult(value: unknown): ReviewResult {
  if (!value || typeof value !== "object" || !("schemaVersion" in value))
    reviewInvalid("unsupported schemaVersion");
  if (typeof value.schemaVersion === "number" && value.schemaVersion !== 8)
    throw new MoklyVersionError("review", value.schemaVersion, 8);
  if (value.schemaVersion !== 8) reviewInvalid("unsupported schemaVersion");
  try {
    return validateResult(value);
  } catch (error) {
    reviewInvalid(
      error instanceof Error ? error.message : "invalid comparison",
    );
  }
}

function validateResult(value: object): ReviewResult {
  const record = reviewObject(value, [
    "schemaVersion",
    "baseCommit",
    "entries",
    "affected",
    "diagnostics",
  ]);
  const result: ReviewResult = {
    schemaVersion: 8,
    baseCommit: reviewCommit(record.baseCommit),
    entries: reviewArray(record.entries).map((entry) => readEntry(entry)),
    affected: reviewArray(record.affected).map(readAffected),
    diagnostics: reviewArray(record.diagnostics).map(readDiagnostic),
  };
  requireCanonicalEntries(result.entries);
  const identities = new Set<string>();
  const historical = new Set<string>();
  for (const { entry, owner } of flattenEntries(result.entries)) {
    validateEntry(entry, owner);
    const identity = asciiLower(entry.path);
    if (identities.has(identity))
      reviewInvalid("an entry path is listed twice");
    identities.add(identity);
    if (!entry.before) continue;
    const before = `${entry.kind}\u0000${asciiLower(entry.before.path)}`;
    if (historical.has(before))
      reviewInvalid("a historical identity is paired twice or also removed");
    historical.add(before);
  }
  requireCanonicalAffected(result.affected);
  validateAffected(result.entries, result.affected);
  return result;
}

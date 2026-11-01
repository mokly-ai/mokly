/** Opaque identities for exact historical catalogue records. */

import { invalidData } from "../components/data.js";
import { sha256 } from "../data/sha256.js";

const HASH_40_OR_64 = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const HASH_64 = /^[a-f0-9]{64}$/;

/** Whether a value is one public historical snapshot identity. */
export function isHistoricalSnapshotId(value: unknown): value is string {
  return typeof value === "string" && HASH_64.test(value);
}

/**
 * Derive one removed record's identity from the comparison's base commit:
 * the source kind is the literal `base`, so a later generation of the same
 * base keeps the identity.
 */
export function historicalSnapshotId(
  catalogueIdentity: string,
  baseCommit: string,
  entry: { path: string; kind: string },
): string {
  if (!HASH_64.test(catalogueIdentity))
    invalidData("$catalogue", "invalid catalogue identity");
  if (!HASH_40_OR_64.test(baseCommit))
    invalidData("$catalogue", "invalid base commit");
  return sha256(
    JSON.stringify([
      "mokly-historical-snapshot-v3",
      catalogueIdentity,
      "base",
      baseCommit,
      entry.kind,
      entry.path,
    ]),
  );
}

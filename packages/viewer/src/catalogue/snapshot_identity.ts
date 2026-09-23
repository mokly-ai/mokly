/** Opaque identities for exact historical catalogue records. */

import { invalidData } from "../components/data.js";
import { sha256 } from "../data/sha256.js";

const HASH_40_OR_64 = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const HASH_64 = /^[a-f0-9]{64}$/;
const COMPARISON_GENERATION =
  /^__mokly\/diffs\/__generations\/([a-f0-9]{64})\/review\.json$/;

export type HistoricalSnapshotSource =
  | { kind: "baseline"; identity: string }
  | { kind: "generation"; identity: string };

/** Whether a value is one public historical snapshot identity. */
export function isHistoricalSnapshotId(value: unknown): value is string {
  return typeof value === "string" && HASH_64.test(value);
}

/** Read the immutable generation from a validated comparison URL. */
export function comparisonGeneration(
  comparisonUrl: string | null,
): string | undefined {
  return comparisonUrl === null
    ? undefined
    : COMPARISON_GENERATION.exec(comparisonUrl)?.[1];
}

/** Derive one per-record identity from real baseline or generation ownership. */
export function historicalSnapshotId(
  catalogueIdentity: string,
  source: HistoricalSnapshotSource,
  entry: { id: string; kind: string; route: string },
): string {
  if (!HASH_64.test(catalogueIdentity))
    invalidData("$catalogue", "invalid catalogue identity");
  if (
    (source.kind === "baseline" && !HASH_40_OR_64.test(source.identity)) ||
    (source.kind === "generation" && !HASH_64.test(source.identity))
  )
    invalidData("$catalogue", "invalid historical source identity");
  return sha256(
    JSON.stringify([
      "mokly-historical-snapshot-v1",
      catalogueIdentity,
      source.kind,
      source.identity,
      entry.kind,
      entry.id,
      entry.route,
    ]),
  );
}

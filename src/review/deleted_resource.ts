/** Shared verified-deletion and byte-comparison policy for referenced resources. */

import { MoklyError } from "../errors.js";

import type { DeletionAssetRead } from "./deletion_read.js";
import { normalizeReviewPair } from "./ignore.js";

interface OptionalResourceReader {
  readIfExists(route: string): Promise<Uint8Array | undefined>;
  readForDeletion?(route: string): Promise<DeletionAssetRead>;
}

export type ResourceDecision =
  | {
      after: Uint8Array;
      byteChanged: boolean;
      kind: "present";
    }
  | {
      before: Uint8Array;
      byteChanged: true;
      kind: "verified-deletion";
    };

/** Verify a current reference and detect retained-byte changes without weakening readers. */
export async function decideReferencedResource(
  route: string,
  beforeReader: OptionalResourceReader,
  afterReader: OptionalResourceReader,
): Promise<ResourceDecision> {
  const candidate = await deletionCandidate(route, afterReader);
  if (candidate.kind === "absent") throw missingResource(route);
  const after = candidate.kind === "present" ? candidate.bytes : undefined;
  if (after === undefined) {
    const before = await beforeReader.readIfExists(route);
    if (before === undefined) throw missingResource(route);
    return { before, byteChanged: true, kind: "verified-deletion" };
  }
  const before = await beforeReader.readIfExists(route);
  return {
    after,
    byteChanged:
      before === undefined || !resourceBytesEqual(route, before, after),
    kind: "present",
  };
}

/** Optional counterparts may be absent; only listed missing files need deletion proof. */
export async function verifiedOptionalResource(
  route: string,
  before: OptionalResourceReader,
  after: OptionalResourceReader,
): Promise<Uint8Array | undefined> {
  const candidate = await deletionCandidate(route, after);
  if (candidate.kind === "absent") return;
  if (candidate.kind === "present") return candidate.bytes;
  const result = await decideReferencedResource(route, before, {
    readIfExists: after.readIfExists.bind(after),
    readForDeletion: async () => candidate,
  });
  return result.kind === "present" ? result.after : undefined;
}

async function deletionCandidate(
  route: string,
  reader: OptionalResourceReader,
): Promise<DeletionAssetRead> {
  if (reader.readForDeletion) return reader.readForDeletion(route);
  const bytes = await reader.readIfExists(route);
  return bytes === undefined ? { kind: "missing" } : { kind: "present", bytes };
}

function resourceBytesEqual(
  route: string,
  before: Uint8Array,
  after: Uint8Array,
): boolean {
  if (!/\.html?$/i.test(route)) return Buffer.from(before).equals(after);
  const pair = normalizeReviewPair(
    Buffer.from(before).toString("utf8"),
    Buffer.from(after).toString("utf8"),
    route,
  );
  return pair.base === pair.head;
}

function missingResource(route: string): MoklyError {
  return new MoklyError(
    "review-invalid",
    `referenced resource is missing: ${route}`,
  );
}

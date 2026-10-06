/** Shared verified-deletion and byte-comparison policy for referenced resources. */

import { MoklyError } from "../errors.js";

import { normalizeReviewPair } from "./ignore.js";

interface OptionalResourceReader {
  readIfExists(route: string): Promise<Uint8Array | undefined>;
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
  changeEvidence: boolean,
  compareBytes: boolean,
): Promise<ResourceDecision> {
  const after = await afterReader.readIfExists(route);
  if (after === undefined) {
    if (!changeEvidence && !compareBytes) throw missingResource(route);
    const before = await beforeReader.readIfExists(route);
    if (before === undefined) throw missingResource(route);
    return { before, byteChanged: true, kind: "verified-deletion" };
  }
  if (!compareBytes) return { after, byteChanged: false, kind: "present" };
  const before = await beforeReader.readIfExists(route);
  return {
    after,
    byteChanged:
      before === undefined || !resourceBytesEqual(route, before, after),
    kind: "present",
  };
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

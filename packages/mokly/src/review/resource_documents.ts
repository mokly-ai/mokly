import { normalizeReviewPair, normalizeSingleDocument } from "./ignore.js";

/** Pair embedded documents before discovering references or matching stylesheet rules. */
export function normalizeResourceDocuments(
  before: string | undefined,
  after: string | undefined,
  route: string,
): { before: string | undefined; after: string | undefined } {
  if (before !== undefined && after !== undefined) {
    const pair = normalizeReviewPair(before, after, route);
    return { before: pair.base, after: pair.head };
  }
  return {
    before:
      before === undefined ? undefined : normalizeSingleDocument(before, route),
    after:
      after === undefined ? undefined : normalizeSingleDocument(after, route),
  };
}

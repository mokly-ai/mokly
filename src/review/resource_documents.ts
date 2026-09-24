import {
  normalizeHistoricalDocument,
  normalizeReviewPair,
  normalizeSingleDocument,
} from "./ignore.js";

/** Pair embedded documents before discovering references or matching stylesheet rules. */
export function normalizeResourceDocuments(
  before: string | undefined,
  after: string | undefined,
  route: string,
  layouts?: { before: string; after: string },
): { before: string | undefined; after: string | undefined } {
  const historical =
    before === undefined ? undefined : normalizeHistoricalDocument(before);
  if (historical !== undefined && after !== undefined) {
    const pair = normalizeReviewPair(historical, after, route, layouts);
    return { before: pair.base, after: pair.head };
  }
  return {
    before:
      historical === undefined
        ? undefined
        : normalizeSingleDocument(historical, route),
    after:
      after === undefined ? undefined : normalizeSingleDocument(after, route),
  };
}

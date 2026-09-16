/** Search-box grammar shared by catalogue filtering and the tag controls. */

/** A search box value split into tag terms and free text. */
export interface SearchQuery {
  freeText: string;
  tags: readonly string[];
}

const TAG_PREFIX = "tag:";

/** Split on whitespace; `tag:<t>` terms (case-insensitive, lowercased) vs text. */
export function parseSearchQuery(raw: string): SearchQuery {
  const freeTerms: string[] = [];
  const tags: string[] = [];
  for (const term of searchTerms(raw)) {
    const tag = tagTermValue(term);
    if (tag === undefined) freeTerms.push(term);
    else tags.push(tag);
  }
  return { freeText: freeTerms.join(" "), tags };
}

/** Every tag term ∈ row tags AND free text ⊆ row id/text/route. */
export function rowMatchesQuery(
  query: SearchQuery,
  row: { id?: string; route: string; tags: readonly string[]; text: string },
): boolean {
  const matchesTags = query.tags.every((tag) =>
    row.tags.some((rowTag) => rowTag.toLowerCase() === tag),
  );
  if (!matchesTags) return false;
  const freeText = query.freeText.toLowerCase();
  return (
    freeText === "" ||
    (row.id ?? "").toLowerCase().includes(freeText) ||
    row.text.toLowerCase().includes(freeText) ||
    row.route.toLowerCase().includes(freeText)
  );
}

/** True when the query constrains rows. */
export function queryConstrains(query: SearchQuery): boolean {
  return query.freeText !== "" || query.tags.length > 0;
}

/** Rewrite raw so its only tag term is `tag:<tag>`, preserving free text. */
export function setTagTerm(raw: string, tag: string): string {
  const term = `${TAG_PREFIX}${tag.toLowerCase()}`;
  return `${parseSearchQuery(raw).freeText} ${term}`.trim();
}

/** Remove `tag:<tag>` terms from raw, preserving free text and other tags. */
export function clearTagTerm(raw: string, tag: string): string {
  const cleared = tag.toLowerCase();
  return searchTerms(raw)
    .filter((term) => tagTermValue(term) !== cleared)
    .join(" ");
}

function searchTerms(raw: string): string[] {
  return raw.split(/\s+/).filter((term) => term !== "");
}

function tagTermValue(term: string): string | undefined {
  const isTagTerm =
    term.length > TAG_PREFIX.length &&
    term.slice(0, TAG_PREFIX.length).toLowerCase() === TAG_PREFIX;
  return isTagTerm ? term.slice(TAG_PREFIX.length).toLowerCase() : undefined;
}

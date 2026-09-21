/** Search-box grammar shared by the React shell and tag controls. */

/** A search box value split into tag terms and free text. */
export interface SearchQuery {
  freeText: string;
  tags: readonly string[];
}

const TAG_PREFIX = "tag:";

/** Split whitespace-delimited tag terms from the remaining search phrase. */
export function parseSearchQuery(raw: string): SearchQuery {
  const freeTerms: string[] = [];
  const tags: string[] = [];
  for (const term of searchTerms(raw)) {
    const tag = tagTermValue(term);
    if (tag === undefined) freeTerms.push(term);
    else tags.push(tag);
  }
  return { freeText: freeTerms.join(" "), tags: [...new Set(tags)] };
}

/** Require every tag and the complete free-text phrase to match one row. */
export function rowMatchesQuery(
  query: SearchQuery,
  row: { id?: string; route: string; tags: readonly string[]; text: string },
): boolean {
  if (
    !query.tags.every((tag) =>
      row.tags.some((rowTag) => rowTag.toLowerCase() === tag),
    )
  )
    return false;
  const freeText = query.freeText.toLowerCase();
  return (
    freeText === "" ||
    (row.id ?? "").toLowerCase().includes(freeText) ||
    row.text.toLowerCase().includes(freeText) ||
    row.route.toLowerCase().includes(freeText)
  );
}

/** Whether a parsed query removes any catalogue rows. */
export function queryConstrains(query: SearchQuery): boolean {
  return query.freeText !== "" || query.tags.length > 0;
}

/** Replace all entered tag terms with one normalized tag. */
export function setTagTerm(raw: string, tag: string): string {
  return `${parseSearchQuery(raw).freeText} ${TAG_PREFIX}${tag.toLowerCase()}`.trim();
}

/** Remove one normalized tag term without changing free text or other tags. */
export function clearTagTerm(raw: string, tag: string): string {
  const cleared = tag.toLowerCase();
  return searchTerms(raw)
    .filter((term) => tagTermValue(term) !== cleared)
    .join(" ");
}

function searchTerms(raw: string): string[] {
  return raw.split(/\s+/).filter(Boolean);
}

function tagTermValue(term: string): string | undefined {
  return term.length > TAG_PREFIX.length &&
    term.slice(0, TAG_PREFIX.length).toLowerCase() === TAG_PREFIX
    ? term.slice(TAG_PREFIX.length).toLowerCase()
    : undefined;
}

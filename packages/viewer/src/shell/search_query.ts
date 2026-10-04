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

/** The fields search compares for one catalogue row. */
export interface SearchRow {
  path: string;
  /** The entry's own title, never a label such as `Overview` or `· Removed`. */
  title: string;
  tags: readonly string[];
  /** Titles of the folders at or above the path, outermost first. */
  folderTitles: readonly string[];
}

/**
 * The one search row for an entry, wherever a view lists it: navigation rows,
 * Changes activation, and route reveals all compare these same fields.
 */
export function searchRow(
  entry: { path: string; title: string; tags?: readonly string[] },
  folderTitles: readonly string[],
): SearchRow {
  return {
    path: entry.path,
    title: entry.title,
    tags: entry.tags ?? [],
    folderTitles,
  };
}

/**
 * Require every tag on the row itself, and the complete free-text phrase in
 * its path, title, or tags, or in the title of a folder at or above it. A
 * folder whose title matches therefore shows every row below it.
 */
export function rowMatchesQuery(query: SearchQuery, row: SearchRow): boolean {
  if (
    !query.tags.every((tag) =>
      row.tags.some((rowTag) => rowTag.toLowerCase() === tag),
    )
  )
    return false;
  const freeText = query.freeText.toLowerCase();
  return (
    freeText === "" ||
    [row.path, row.title, ...row.tags, ...row.folderTitles].some((text) =>
      text.toLowerCase().includes(freeText),
    )
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

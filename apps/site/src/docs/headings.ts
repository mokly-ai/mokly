/**
 * The headings a documentation page publishes. Astro's Markdown pipeline
 * gives every heading a stable id from its text; this module selects the ones
 * the "On this page" list carries and refuses a page whose headings would
 * share an id, because one of those two anchors could never be reached.
 */

/** One heading of a rendered document. */
export interface DocsHeading {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}

/** The headings the on-this-page list carries, in document order. */
export function onThisPage(
  headings: readonly DocsHeading[],
): readonly DocsHeading[] {
  return headings.filter(
    (heading) => heading.depth === 2 || heading.depth === 3,
  );
}

/** Fail the build when one page repeats a heading, and so repeats an id. */
export function assertUniqueHeadings(
  headings: readonly DocsHeading[],
  at: string,
): void {
  const seen = new Set<string>();
  for (const heading of headings) {
    const key = heading.text.trim().toLowerCase();
    if (seen.has(key)) {
      throw new Error(`${at}: repeats the heading "${heading.text.trim()}"`);
    }
    seen.add(key);
  }
}

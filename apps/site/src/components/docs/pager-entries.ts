/**
 * The pages that previous and next name at the foot of a document. Each
 * names its section, title and description. The reading sequence opens with
 * the documentation landing, whose section the trail and the pager both call
 * Documentation.
 */

import { DOCS_OVERVIEW, neighbours, pageAt } from "../../docs/pages.js";
import { SECTION_TITLES } from "../../docs/sections.js";

/**
 * The documentation as a whole: the first step of every page's trail, and
 * the section of the landing, which belongs to no section of the tree.
 */
export const DOCUMENTATION = "Documentation";

/** One neighbour in the reading sequence, as a pager frame names it. */
export interface PagerEntry {
  readonly description: string;
  readonly route: string;
  readonly section: string;
  readonly title: string;
}

function entry(route: string, title: string): PagerEntry {
  const page = pageAt(route);
  if (page) {
    return {
      description: page.description,
      route,
      section: SECTION_TITLES[page.section],
      title,
    };
  }
  if (route === DOCS_OVERVIEW.route) {
    return {
      description: DOCS_OVERVIEW.description,
      route,
      section: DOCUMENTATION,
      title,
    };
  }
  throw new Error(`${route}: not a documentation page`);
}

/** The pages either side of a route, with what each pager frame names. */
export function pagerEntries(route: string): {
  readonly next?: PagerEntry;
  readonly previous?: PagerEntry;
} {
  const { next, previous } = neighbours(route);
  return {
    ...(next ? { next: entry(next.route, next.title) } : {}),
    ...(previous ? { previous: entry(previous.route, previous.title) } : {}),
  };
}

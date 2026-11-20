/**
 * The model of a documentation page that the docs mockup draws: the guide's
 * title, section, source file and description, its `h2` sections with their
 * heading ids, and its neighbours in the reading sequence. Two guides of the
 * workspace `@mokly/mokly` package are drawn word for word: Install, the
 * documentation screen, and Your first screen, its variant. Every other page
 * has no owning mockup, so the tree, the pager and the prose name it as plain
 * text.
 */

import type { ReactNode } from "react";

import { EXTERNAL_LINKS, SITE_SCREENS } from "./links.js";

/** One `h2` section of a page: its heading id, its title and its body. */
export interface DocsPageSection {
  readonly body: ReactNode;
  readonly id: string;
  readonly title: string;
}

/** A page next to the drawn one in the reading sequence. */
export interface DocsNeighbour {
  readonly description: string;
  readonly section: string;
  readonly title: string;
}

/** One drawn documentation page. */
export interface DocsPage {
  /** The guide's description, set as the lead under the title. */
  readonly description: string;
  /** The guide's path under the package's guides, such as `start/install.md`. */
  readonly file: string;
  readonly next: DocsNeighbour;
  readonly previous: DocsNeighbour;
  /** The section title, as the tree names it. */
  readonly section: string;
  readonly sections: readonly DocsPageSection[];
  /** The size tag under the page frame in each composition. */
  readonly size: Readonly<Record<"desktop" | "mobile", string>>;
  readonly title: string;
}

/** The catalogue path of the Your first screen variant. */
export const FIRST_SCREEN_SCREEN = `${SITE_SCREENS.docs}/first-screen`;

/** The entry that draws each page that a mockup owns, by section and title. */
const OWNED_PAGES: Readonly<Record<string, string>> = {
  "Getting started/Install": SITE_SCREENS.docs,
  "Getting started/Your first screen": FIRST_SCREEN_SCREEN,
};

/** The entry that draws one page of the tree, or nothing when none owns it. */
export function docsPageScreen(
  section: string,
  title: string,
): string | undefined {
  return OWNED_PAGES[`${section}/${title}`];
}

/**
 * Where Edit on GitHub opens a guide's source: the tracked `docs/guides`
 * Markdown of the repository, which the package build copies into its own
 * ignored `docs/guides`.
 */
export function guideSource(file: string): string {
  return `${EXTERNAL_LINKS.github}/edit/main/docs/guides/${file}`;
}

/** The two-digit index of a section, such as `01`. */
export function sectionIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

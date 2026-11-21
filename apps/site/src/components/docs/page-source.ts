/**
 * Where each documentation page's source lives and what the page states
 * about itself. The frame label names the tracked source path under its own
 * root, Edit on GitHub opens that file on the `main` branch of the public
 * repository, and the page facts name the section and, for a page that the
 * installed `@mokly/mokly` package owns, its version and package.
 *
 * A guide's `page.source` points into the installed package, whose copy of
 * the guides Git ignores, so nothing here reads it. Each path is rebuilt
 * from the page's kind and id instead.
 */

import type { DocsPage } from "../../docs/pages.js";
import {
  REFERENCE_DOCUMENTS,
  referenceRoute,
} from "../../docs/reference-allowlist.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../../docs/version.js";
import { EXTERNAL_LINKS } from "../../navigation.js";

/** The tracked source of one documentation page. */
export interface PageSource {
  /** The path the frame label names, under the source's own root. */
  readonly label: string;
  /** Whether the installed `@mokly/mokly` package owns the page. */
  readonly packaged: boolean;
  /** The repository path of the tracked file. */
  readonly path: string;
}

/** The directory of the package guides in the public repository. */
const GUIDES = "docs/guides";

/** The directory of the repository-owned documentation pages. */
const CLOUD_PAGES = "apps/site/src/content/docs";

/** The prefix of the repository root that a protocol label leaves out. */
const DOCS_ROOT = "docs/";

/** The documentation landing, which this site writes as an Astro page. */
export const LANDING_SOURCE: PageSource = Object.freeze({
  label: "docs/index.astro",
  packaged: false,
  path: "apps/site/src/pages/docs/index.astro",
});

/** The tracked source of a published documentation page. */
export function pageSource(page: DocsPage): PageSource {
  switch (page.kind) {
    case "guide":
      return {
        label: `${page.id}.md`,
        packaged: true,
        path: `${GUIDES}/${page.id}.md`,
      };
    case "page":
      return {
        label: `${page.id}.md`,
        packaged: false,
        path: `${CLOUD_PAGES}/${page.id}.md`,
      };
    case "reference": {
      const document = REFERENCE_DOCUMENTS.find(
        (entry) => referenceRoute(entry.slug) === page.route,
      );
      if (!document) {
        throw new Error(`${page.id}: no allowlisted protocol document`);
      }
      return {
        label: document.source.slice(DOCS_ROOT.length),
        packaged: true,
        path: document.source,
      };
    }
  }
}

/** GitHub's editor for the tracked source on the `main` branch. */
export function editUrl(source: PageSource): string {
  return `${EXTERNAL_LINKS.github}/edit/main/${source.path}`;
}

/** The file name of the tracked source, such as `install.md`. */
export function sourceFile(source: PageSource): string {
  return source.label.slice(source.label.lastIndexOf("/") + 1);
}

/** One labelled fact of a page, as the Inspect panel lists it. */
export interface PageFact {
  readonly label: "Package" | "Section" | "Version";
  readonly value: string;
}

/**
 * The facts a page states: its section always, and the installed package's
 * version and name for a page that the package owns.
 */
export function pageFacts(
  source: PageSource,
  section: string,
): readonly PageFact[] {
  const facts: PageFact[] = [{ label: "Section", value: section }];
  if (source.packaged) {
    facts.push(
      { label: "Version", value: PACKAGE_VERSION },
      { label: "Package", value: PACKAGE_NAME },
    );
  }
  return facts;
}

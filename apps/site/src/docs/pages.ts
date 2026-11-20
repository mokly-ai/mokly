/**
 * Every documentation page the site publishes, in the order the section tree
 * lists them. The pages are read from their Markdown sources on disk and joined
 * with the published protocol documents, so the navigation, the previous and
 * next links, the social cards, the sitemap and the coverage tests all read
 * one list. Astro renders the same files through the `docs` content
 * collection; `assertCollection` keeps the two sets equal at build time.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PAGE_METADATA } from "../metadata.js";
import {
  moklyPackagePath,
  requiredMoklyPackagePath,
} from "../mokly-package.js";
import { SITE_PATHS } from "../navigation.js";
import { sitePath } from "../workspace.js";

import { readFrontmatter } from "./frontmatter.js";
import { REFERENCE_DOCUMENTS, referenceRoute } from "./reference-allowlist.js";
import { SECTION_TITLES, sectionOrder, type SectionId } from "./sections.js";

/** The directory holding the authored documentation pages. */
export const DOCS_CONTENT = sitePath("src", "content", "docs");

/** The package-owned guide directory inside the installed CLI. */
export const GUIDE_CONTENT = requiredMoklyPackagePath("docs", "guides");

const PACKAGE_SECTIONS: ReadonlySet<SectionId> = new Set([
  "start",
  "authoring",
  "catalogue",
  "ci",
  "cli",
]);
const CLOUD_SECTIONS: ReadonlySet<SectionId> = new Set(["cloud", "review"]);

/** One page in the documentation, authored or published from the protocol. */
export interface DocsPage {
  readonly description: string;
  /** Collection id and route tail, `<section>/<slug>`. */
  readonly id: string;
  readonly kind: "guide" | "page" | "reference";
  readonly order: number;
  readonly route: string;
  readonly section: SectionId;
  /** Absolute path of the Markdown source. */
  readonly source: string;
  readonly status?: "ahead";
  readonly title: string;
}

/** The documentation landing page, which is the Getting started overview. */
export const DOCS_OVERVIEW = Object.freeze({
  description: PAGE_METADATA[SITE_PATHS.docs].description,
  route: SITE_PATHS.docs,
  title: "Getting started",
});

function markdownPages(
  directoryRoot: string,
  kind: "guide" | "page",
): DocsPage[] {
  const pages: DocsPage[] = [];
  for (const entry of readdirSync(directoryRoot, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".md")) {
      throw new Error(`${entry.name}: documentation pages are Markdown files`);
    }
    const directory = path.relative(directoryRoot, entry.parentPath);
    const slug = entry.name.slice(0, -".md".length);
    const source = path.join(entry.parentPath, entry.name);
    const at = path.relative(directoryRoot, source);
    const { data } = readFrontmatter(readFileSync(source, "utf8"), at);
    if (directory !== data.section) {
      throw new Error(`${at}: belongs to the ${data.section} section`);
    }
    const owner = kind === "guide" ? PACKAGE_SECTIONS : CLOUD_SECTIONS;
    if (!owner.has(data.section)) {
      throw new Error(`${at}: the ${data.section} section has another owner`);
    }
    if (kind === "guide" && data.status !== undefined) {
      throw new Error(`${at}: package-owned guides cannot be ahead`);
    }
    if (kind === "page" && data.status !== "ahead") {
      throw new Error(`${at}: cloud-owned guides must declare status: ahead`);
    }
    pages.push({
      description: data.description,
      id: `${data.section}/${slug}`,
      kind,
      order: data.order,
      route: `/docs/${data.section}/${slug}/`,
      section: data.section,
      source,
      ...(data.status ? { status: data.status } : {}),
      title: data.title,
    });
  }
  return pages;
}

function published(): DocsPage[] {
  return REFERENCE_DOCUMENTS.map((document) => ({
    description: document.description,
    id: `reference/${document.slug}`,
    kind: "reference" as const,
    order: document.order,
    route: referenceRoute(document.slug),
    section: "reference" as SectionId,
    source: moklyPackagePath(document.source),
    title: document.title,
  }));
}

function ordered(pages: readonly DocsPage[]): readonly DocsPage[] {
  const seen = new Map<string, string>();
  for (const page of pages) {
    const key = `${page.section}/${page.order}`;
    const taken = seen.get(key);
    if (taken) throw new Error(`${page.id}: takes the order of ${taken}`);
    seen.set(key, page.id);
    if (page.kind === "page" && page.section === "reference") {
      throw new Error(`${page.id}: the reference section is published`);
    }
  }
  const ids = new Set(pages.map((page) => page.id));
  if (ids.size !== pages.length) throw new Error("duplicate documentation id");
  return Object.freeze(
    [...pages].sort(
      (left, right) =>
        sectionOrder(left.section) - sectionOrder(right.section) ||
        left.order - right.order,
    ),
  );
}

/** Every documentation page, in section then page order. */
export const DOCS_PAGES: readonly DocsPage[] = ordered([
  ...markdownPages(GUIDE_CONTENT, "guide"),
  ...markdownPages(DOCS_CONTENT, "page"),
  ...published(),
]);

/** One section of the tree: its title and its pages in order. */
export interface DocsSection {
  readonly id: SectionId;
  readonly pages: readonly DocsPage[];
  readonly title: string;
}

/** The sections that have pages, in reading order. */
export const DOCS_SECTIONS: readonly DocsSection[] = Object.freeze(
  [...new Set(DOCS_PAGES.map((page) => page.section))].map((id) => ({
    id,
    pages: DOCS_PAGES.filter((page) => page.section === id),
    title: SECTION_TITLES[id],
  })),
);

/** The reading sequence previous and next follow, overview first. */
const SEQUENCE: readonly { route: string; title: string }[] = [
  DOCS_OVERVIEW,
  ...DOCS_PAGES,
].map((page) => ({ route: page.route, title: page.title }));

/** The pages either side of a route in the reading sequence. */
export function neighbours(route: string): {
  readonly next?: { route: string; title: string };
  readonly previous?: { route: string; title: string };
} {
  const at = SEQUENCE.findIndex((page) => page.route === route);
  if (at < 0) return {};
  return {
    ...(SEQUENCE[at + 1] ? { next: SEQUENCE[at + 1] } : {}),
    ...(at > 0 && SEQUENCE[at - 1] ? { previous: SEQUENCE[at - 1] } : {}),
  };
}

/** The page published at a route. */
export function pageAt(route: string): DocsPage | undefined {
  return DOCS_PAGES.find((page) => page.route === route);
}

/** Fail the build when Astro's collection and this list describe other pages. */
export function assertCollection(ids: readonly string[]): void {
  const collection = [...ids].sort();
  const expected = DOCS_PAGES.filter((page) => page.kind !== "reference")
    .map((page) => page.id)
    .sort();
  if (collection.join("|") !== expected.join("|")) {
    throw new Error(
      `the docs collection holds ${collection.join(", ")}; the navigation lists ${expected.join(", ")}`,
    );
  }
}

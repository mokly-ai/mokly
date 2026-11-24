/**
 * The releases the site publishes, read from the installed package's own
 * `CHANGELOG.md` at build time and decorated with the anchors and the
 * readable date that the page and the feed both use. A note's relative link
 * to a guide of the package, such as `docs/guides/start/upgrade.md`, points
 * at that guide's page when the site publishes it.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { DOCS_PAGES, type DocsPage } from "../docs/pages.js";
import { moklyPackagePath } from "../mokly-package.js";

import { type AnchoredRelease, anchorReleases } from "./anchors.js";
import { type LinkResolver, publishedHref } from "./notes.js";
import { type Release, parseChangelog } from "./parse.js";

/** The changelog the site publishes. */
export const CHANGELOG_FILE = moklyPackagePath("CHANGELOG.md");

/** A release with the anchors and the readable date the page renders. */
export interface PublishedRelease extends AnchoredRelease {
  readonly readableDate: string;
}

const READABLE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

/** The release date as the page shows it, in UTC so the build is stable. */
export function readableDate(date: string): string {
  return READABLE.format(new Date(`${date}T00:00:00Z`));
}

/**
 * The destinations of a changelog's note links: a link that the site
 * publishes without help keeps its destination, and a relative link to the
 * Markdown source of a published guide points at the guide's route, with its
 * fragment. Any other link keeps only its text.
 */
export function changelogLinks(
  file: string,
  pages: readonly DocsPage[] = DOCS_PAGES,
): LinkResolver {
  const routes = new Map(
    pages
      .filter((page) => page.kind === "guide")
      .map((page) => [path.resolve(page.source), page.route]),
  );
  return (destination) => {
    const kept = publishedHref(destination);
    if (kept !== undefined) return kept;
    if (/^[a-z][a-z\d+.-]*:/i.test(destination)) return undefined;
    const hash = destination.indexOf("#");
    const target = hash < 0 ? destination : destination.slice(0, hash);
    const route = routes.get(path.resolve(path.dirname(file), target));
    return route === undefined
      ? undefined
      : `${route}${hash < 0 ? "" : destination.slice(hash)}`;
  };
}

/** Decorate parsed releases with what the page and the feed both need. */
export function publishedReleases(
  releases: readonly Release[],
): readonly PublishedRelease[] {
  return anchorReleases(releases).map((release) => ({
    ...release,
    readableDate: readableDate(release.date),
  }));
}

/** Every release in the installed package's changelog, newest first. */
export function readReleases(
  file = CHANGELOG_FILE,
): readonly PublishedRelease[] {
  return publishedReleases(
    parseChangelog(readFileSync(file, "utf8"), changelogLinks(file)),
  );
}

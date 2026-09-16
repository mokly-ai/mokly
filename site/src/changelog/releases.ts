/**
 * The releases the site publishes, read from this repository's own
 * `CHANGELOG.md` at build time and decorated with the anchor and the readable
 * date the page and the feed both use.
 */

import { readFileSync } from "node:fs";

import { repositoryPath } from "../workspace.js";

import { type Release, parseChangelog } from "./parse.js";

/** The changelog the site publishes. */
export const CHANGELOG_FILE = repositoryPath("CHANGELOG.md");

/** A release with the anchor and readable date the page renders. */
export interface PublishedRelease extends Release {
  readonly anchor: string;
  readonly readableDate: string;
}

const READABLE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

/** The anchor a release takes on the changelog page. */
export function releaseAnchor(version: string): string {
  return `release-${version.replace(/[^0-9a-z]+/gi, "-").toLowerCase()}`;
}

/** The release date as the page shows it, in UTC so the build is stable. */
export function readableDate(date: string): string {
  return READABLE.format(new Date(`${date}T00:00:00Z`));
}

/** Decorate parsed releases with what the page and the feed both need. */
export function publishedReleases(
  releases: readonly Release[],
): readonly PublishedRelease[] {
  return releases.map((release) => ({
    ...release,
    anchor: releaseAnchor(release.version),
    readableDate: readableDate(release.date),
  }));
}

/** Every release in this repository's changelog, newest first. */
export function readReleases(
  file = CHANGELOG_FILE,
): readonly PublishedRelease[] {
  return publishedReleases(parseChangelog(readFileSync(file, "utf8")));
}

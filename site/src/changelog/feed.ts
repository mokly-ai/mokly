/**
 * The Atom feed the changelog publishes at `/changelog.xml`. Every entry
 * carries one release: its version as the title, its date, the release link
 * when the changelog names one, and the grouped notes as plain text.
 */

import { canonicalUrl } from "../metadata.js";
import { SITE_PATHS } from "../navigation.js";

import { noteText } from "./notes.js";
import type { PublishedRelease } from "./releases.js";

/** The site path the feed is published at. */
export const FEED_PATH = "/changelog.xml";

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] ?? character,
  );
}

function summary(release: PublishedRelease): string {
  return release.sections
    .map(
      (section) =>
        `${section.heading}: ${section.items.map((item) => noteText(item)).join("; ")}`,
    )
    .join("\n");
}

function entry(release: PublishedRelease, origin: string): string {
  const page = `${canonicalUrl(SITE_PATHS.changelog, origin)}#${release.anchor}`;
  return [
    "  <entry>",
    `    <id>${escapeXml(page)}</id>`,
    `    <title>Mokly CLI ${escapeXml(release.version)}</title>`,
    `    <updated>${escapeXml(release.date)}T00:00:00Z</updated>`,
    `    <link rel="alternate" href="${escapeXml(release.link ?? page)}" />`,
    `    <summary>${escapeXml(summary(release))}</summary>`,
    "  </entry>",
  ].join("\n");
}

/** The complete feed document for the releases the site publishes. */
export function changelogFeed(
  releases: readonly PublishedRelease[],
  origin: string,
): string {
  const changelog = canonicalUrl(SITE_PATHS.changelog, origin);
  const updated = releases[0]?.date;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${escapeXml(changelog)}</id>`,
    "  <title>Mokly CLI releases</title>",
    `  <link rel="alternate" href="${escapeXml(changelog)}" />`,
    `  <link rel="self" href="${escapeXml(canonicalUrl(FEED_PATH, origin))}" />`,
    ...(updated
      ? [`  <updated>${escapeXml(updated)}T00:00:00Z</updated>`]
      : []),
    ...releases.map((release) => entry(release, origin)),
    "</feed>",
    "",
  ].join("\n");
}

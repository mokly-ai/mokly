/**
 * The Atom feed the changelog publishes at `/changelog.xml`. Every entry
 * carries one release: its version as the title, its date, the release link
 * when the changelog names one, and as plain text a line for each group of
 * notes, then a line that names the topics of the upgrade notes, which the
 * page holds in full.
 */

import { canonicalUrl } from "../metadata.js";
import { SITE_PATHS } from "../navigation.js";

import type { NoteItem, ReleaseNote } from "./items.js";
import { noteText } from "./notes.js";
import type { ReleaseGroup } from "./parse.js";
import type { PublishedRelease } from "./releases.js";

/** The site path the feed is published at. */
export const FEED_PATH = "/changelog.xml";

/** The feed's name of a release-tool group heading. */
const HEADINGS: Readonly<Record<string, string>> = {
  "⚠ BREAKING CHANGES": "Breaking changes",
  "Bug Fixes": "Bug fixes",
  Features: "Features",
  "Performance Improvements": "Performance",
  Reverts: "Reverts",
};

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

function heading(group: ReleaseGroup): string {
  return HEADINGS[group.heading] ?? group.heading.replace(/^⚠\s*/, "");
}

/** Each nested item, depth first, as ` * text`. */
function nested(items: readonly NoteItem[]): string {
  return items
    .map((item) => ` * ${noteText(item.text)}${nested(item.items)}`)
    .join("");
}

/**
 * A note as one line of text: its scope, its text, its issue and commit
 * labels in parentheses and its nested items, in the order the release tool
 * wrote them.
 */
function noteLine(note: ReleaseNote): string {
  const scope = note.scope === undefined ? "" : `${note.scope}: `;
  const refs = note.refs.map((ref) => ` (${ref.label})`).join("");
  return `${scope}${noteText(note.text)}${refs}${nested(note.items)}`;
}

function summary(release: PublishedRelease): string {
  const topics = release.upgrade.flatMap((topic) =>
    topic.title === undefined ? [] : [noteText(topic.title)],
  );
  return [
    ...release.groups.map(
      (group) => `${heading(group)}: ${group.notes.map(noteLine).join("; ")}`,
    ),
    ...(topics.length > 0 ? [`Upgrade notes: ${topics.join("; ")}`] : []),
  ].join("\n");
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

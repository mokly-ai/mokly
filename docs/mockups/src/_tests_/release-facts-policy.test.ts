import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { RELEASES } from "../screens/design/site/parts/releases";

import { only } from "./design-site-changelog-helpers";
import {
  attribute,
  byClass,
  elements,
  label,
  repositoryRoot,
  siteDocument,
} from "./design-site-test-helpers";

const changelog = readFileSync(
  resolve(repositoryRoot, "node_modules/@mokly/mokly/CHANGELOG.md"),
  "utf8",
);

/**
 * The words of a note as the page shows them: the release tool's Markdown
 * without its bold scope marks, code span marks and link targets, and its
 * first line only, without nested items.
 */
function shownWords(note: string): string {
  return (note.split("\n")[0] ?? "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\(\[([^\]]+)\]\([^)\s]+\)\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1");
}

/** The upgrade notes of one release's own section, or nothing without them. */
function publishedUpgrade(version: string): string | undefined {
  const start = changelog.indexOf("## [" + version + "]");
  assert.ok(start >= 0, version);
  const next = changelog.indexOf("\n## [", start + 1);
  const section = changelog.slice(start, next < 0 ? undefined : next);
  return section.split("### Upgrade Notes")[1]?.split("\n### ")[0];
}

/**
 * The words of upgrade notes as the page shows them: code spans and links as
 * their text. A `**` inside a code span stays, so bold marks stay too.
 */
function shownProse(markdown: string): string {
  return markdown
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\s+/g, " ");
}

test("depicted releases remain facts from the installed package changelog", () => {
  const { document } = siteDocument("design/site/changelog", "desktop");
  const text = label(document);
  for (const fact of [
    "Mokly CLI 0.14.0",
    "add co-located entries and screen variants",
    "replace collections with navigation paths",
    "Mokly CLI 0.12.0",
    "improve terminal experience",
    "show previous versions of removed pages and screens",
    "hydrate the shared Browse shell",
  ]) {
    assert.ok(text.includes(fact), fact);
    assert.ok(
      changelog
        .toLowerCase()
        .includes(fact.replace("Mokly CLI ", "").toLowerCase()),
    );
  }
  const newest = RELEASES[0];
  assert.ok(newest);
  const releaseStart = changelog.indexOf("## [" + newest.version + "]");
  assert.ok(releaseStart >= 0, newest.version);
  const nextRelease = changelog.indexOf("\n## [", releaseStart + 1);
  const published = changelog
    .slice(releaseStart, nextRelease < 0 ? undefined : nextRelease)
    .toLowerCase();
  for (const group of newest.groups)
    for (const note of group.notes) {
      assert.ok(
        text.toLowerCase().includes(shownWords(note).toLowerCase()),
        "rendered note: " + note,
      );
      assert.ok(
        published.includes(note.toLowerCase()),
        "published note: " + note,
      );
    }
  // Version history and the release frames each date every depicted release,
  // newest first, and no other element on the page is a date.
  const isTime = (node: { tagName: string }) => node.tagName === "time";
  const history = byClass(document, "site-release-index").flatMap((panel) =>
    elements(panel, isTime),
  );
  const frames = byClass(document, "site-release").flatMap((frame) =>
    elements(frame, isTime),
  );
  assert.equal(
    elements(document, isTime).length,
    history.length + frames.length,
  );
  for (const [where, times] of [
    ["Version history", history],
    ["release frames", frames],
  ] as const) {
    assert.equal(times.length, RELEASES.length, where);
    for (const [index, release] of RELEASES.entries()) {
      const heading = changelog
        .split("\n")
        .find((line) => line.startsWith("## [" + release.version + "]"));
      assert.ok(heading, release.version);
      const date = /\((\d{4}-\d{2}-\d{2})\)$/.exec(heading)?.[1];
      assert.ok(date, release.version + " release date");
      assert.equal(
        attribute(times[index]!, "datetime"),
        date,
        where + " " + release.version,
      );
    }
  }
});

test("depicted upgrade notes come word for word from their release's own section", () => {
  const { document } = siteDocument("design/site/changelog", "desktop");
  const published = RELEASES.map((release) => release.version).filter(
    (version) => publishedUpgrade(version) !== undefined,
  );
  const frames = byClass(document, "site-release");
  const frameOf = (version: string) =>
    only(
      frames.filter(
        (frame) =>
          attribute(frame, "id") === "release-" + version.replaceAll(".", "-"),
      ),
      version,
    );
  assert.deepEqual(
    RELEASES.map((release) => release.version).filter(
      (version) =>
        byClass(frameOf(version), "site-release-upgrade-body").length > 0,
    ),
    published,
  );
  for (const version of published) {
    const notes = publishedUpgrade(version) ?? "";
    const body = only(
      byClass(frameOf(version), "site-release-upgrade-body"),
      version,
    );
    const blocks = elements(body, (node) =>
      ["h4", "h5", "p", "li"].includes(node.tagName),
    );
    assert.deepEqual(
      blocks.filter((block) => block.tagName === "h4").map(label),
      [...notes.matchAll(/^#### (.+)$/gm)].map((match) => match[1]),
      version,
    );
    const words = shownProse(notes);
    for (const block of blocks)
      assert.ok(words.includes(label(block)), version + ": " + label(block));
  }
});

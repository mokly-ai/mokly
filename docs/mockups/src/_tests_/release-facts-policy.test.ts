import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { RELEASES } from "../screens/design/site/parts/releases";

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

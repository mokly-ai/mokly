import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { RELEASES } from "../screens/design/site/parts/releases";
import {
  attribute,
  elements,
  label,
  repositoryRoot,
  siteDocument,
} from "./design-site-test-helpers";

const changelog = readFileSync(
  resolve(repositoryRoot, "node_modules/@mokly/mokly/CHANGELOG.md"),
  "utf8",
);

test("depicted releases remain facts from the installed package changelog", () => {
  const { document } = siteDocument("design/site/changelog", "desktop");
  const text = label(document);
  for (const fact of [
    "Mokly CLI 0.14.0",
    "Add co-located entries and screen variants",
    "Replace collections with navigation paths",
    "Mokly CLI 0.12.0",
    "Improve terminal experience",
    "Show previous versions of removed pages and screens",
    "Hydrate the shared Browse shell",
  ]) {
    assert.ok(text.includes(fact), fact);
    assert.ok(
      changelog
        .toLowerCase()
        .includes(fact.replace("Mokly CLI ", "").toLowerCase()),
    );
  }
  const newest = RELEASES[0];
  const releaseStart = changelog.indexOf("## [" + newest.version + "]");
  assert.ok(releaseStart >= 0, newest.version);
  const nextRelease = changelog.indexOf("\n## [", releaseStart + 1);
  const published = changelog
    .slice(releaseStart, nextRelease < 0 ? undefined : nextRelease)
    .toLowerCase();
  for (const group of newest.groups)
    for (const note of group.notes) {
      assert.ok(
        text.toLowerCase().includes(note.toLowerCase()),
        "rendered note: " + note,
      );
      assert.ok(
        published.includes(note.toLowerCase()),
        "published note: " + note,
      );
    }
  const times = elements(document, (node) => node.tagName === "time");
  assert.equal(times.length, RELEASES.length);
  for (const [index, release] of RELEASES.entries()) {
    const heading = changelog
      .split("\n")
      .find((line) => line.startsWith("## [" + release.version + "]"));
    assert.ok(heading, release.version);
    const date = /\((\d{4}-\d{2}-\d{2})\)$/.exec(heading)?.[1];
    assert.ok(date, release.version + " release date");
    assert.equal(attribute(times[index]!, "datetime"), date, release.version);
  }
});

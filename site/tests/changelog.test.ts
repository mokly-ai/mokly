import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import sax from "sax";

import { changelogFeed } from "../src/changelog/feed.js";
import { parseNote, noteText } from "../src/changelog/notes.js";
import { ChangelogError, parseChangelog } from "../src/changelog/parse.js";
import {
  CHANGELOG_FILE,
  publishedReleases,
  readReleases,
  releaseAnchor,
} from "../src/changelog/releases.js";

const origin = "https://mokly.example";

/** Every release heading the file itself declares, read independently. */
function headings(): string[] {
  return readFileSync(CHANGELOG_FILE, "utf8")
    .split("\n")
    .filter((line) => /^## \[?v?\d+\.\d+/.test(line));
}

test("every release in this repository's changelog is published", () => {
  const releases = readReleases();
  assert.equal(releases.length, headings().length);
  assert.ok(releases.length > 1, "the changelog has more than one release");
  for (const release of releases) {
    assert.match(release.version, /^\d+\.\d+\.\d+/);
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(release.sections.length > 0, release.version);
    for (const section of release.sections) {
      assert.ok(section.heading.length > 0);
      assert.ok(section.items.length > 0, section.heading);
    }
  }
});

test("the newest release is first and keeps its link and notes", () => {
  const [newest] = readReleases();
  assert.ok(newest);
  assert.equal(newest.version, "0.9.0");
  assert.equal(newest.date, "2026-09-15");
  assert.equal(newest.readableDate, "15 September 2026");
  assert.equal(newest.anchor, "release-0-9-0");
  assert.equal(
    newest.link,
    "https://github.com/mokly-ai/mokly/compare/v0.8.0...v0.9.0",
  );
  assert.deepEqual(
    newest.sections.map((section) => section.heading),
    ["Breaking changes", "Features", "Bug fixes"],
  );
});

test("a heading with no link publishes no link", () => {
  const releases = parseChangelog(
    "## 0.1.0 (2026-07-20)\n\n### Features\n\n* first\n",
  );
  assert.deepEqual(releases, [
    {
      date: "2026-07-20",
      link: null,
      sections: [
        { heading: "Features", items: [[{ kind: "text", value: "first" }]] },
      ],
      version: "0.1.0",
    },
  ]);
});

test("an empty file publishes no releases", () => {
  assert.deepEqual(parseChangelog(""), []);
  assert.deepEqual(parseChangelog("# Changelog\n\nNothing yet.\n"), []);
});

test("a heading that names no version is prose, and is skipped", () => {
  const releases = parseChangelog(
    "## 0.1.0 (2026-07-20)\n\n### Features\n\n* first\n\n## Unreleased\n\n### Added\n\n- later\n",
  );
  assert.deepEqual(
    releases.map((release) => release.version),
    ["0.1.0"],
  );
});

test("a heading that names a version but no date fails the build", () => {
  for (const heading of [
    "## 0.9.0",
    "## [0.9.0](https://example.com/compare)",
    "## 0.9.0 (yesterday)",
    "## [0.9.0](https://example.com) (2026-13)",
  ]) {
    assert.throws(() => parseChangelog(`${heading}\n`), ChangelogError);
  }
});

test("notes keep their links, code and emphasis as typed segments", () => {
  assert.deepEqual(
    parseNote("**shell:** add `mokly build` ([#60](https://example.com/60))"),
    [
      { kind: "strong", value: "shell:" },
      { kind: "text", value: " add " },
      { kind: "code", value: "mokly build" },
      { kind: "text", value: " (" },
      { href: "https://example.com/60", kind: "link", text: "#60" },
      { kind: "text", value: ")" },
    ],
  );
  assert.equal(
    noteText(parseNote("**shell:** add [#60](https://example.com/60)")),
    "shell: add #60",
  );
});

test("a note never publishes a destination the site would not serve", () => {
  assert.deepEqual(parseNote("[click](javascript:alert)"), [
    { kind: "text", value: "click" },
  ]);
  assert.deepEqual(parseNote("[docs](/docs/)"), [
    { href: "/docs/", kind: "link", text: "docs" },
  ]);
});

test("a multi-line note is joined into one item", () => {
  const [release] = parseChangelog(
    "## 0.1.0 (2026-07-20)\n\n### Features\n\n* first line\n  second line\n",
  );
  assert.deepEqual(release?.sections[0]?.items, [
    [{ kind: "text", value: "first line second line" }],
  ]);
});

test("the release anchor is stable and readable", () => {
  assert.equal(releaseAnchor("0.9.0"), "release-0-9-0");
  assert.equal(releaseAnchor("1.0.0-rc.1"), "release-1-0-0-rc-1");
});

test("the feed is well-formed XML naming every release", () => {
  const releases = readReleases();
  const feed = changelogFeed(releases, origin);
  const parser = sax.parser(true);
  let entries = 0;
  parser.onopentag = (node): void => {
    if (node.name === "entry") entries += 1;
  };
  parser.write(feed).close();
  assert.equal(entries, releases.length);
  assert.ok(feed.includes("<title>Mokly CLI 0.9.0</title>"));
  assert.ok(feed.includes(`${origin}/changelog.xml`));
});

test("the feed escapes release text and falls back to the page anchor", () => {
  const feed = changelogFeed(
    publishedReleases([
      {
        date: "2026-07-20",
        link: null,
        sections: [
          {
            heading: "Features",
            items: [[{ kind: "text", value: "a & b <c>" }]],
          },
        ],
        version: "0.1.0",
      },
    ]),
    origin,
  );
  sax.parser(true).write(feed).close();
  assert.ok(feed.includes("a &amp; b &lt;c&gt;"));
  assert.ok(feed.includes(`${origin}/changelog/#release-0-1-0`));
});

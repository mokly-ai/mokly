import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import sax from "sax";

import { releaseAnchor } from "../src/changelog/anchors.js";
import { changelogFeed } from "../src/changelog/feed.js";
import { parseNote, noteText } from "../src/changelog/notes.js";
import { ChangelogError, parseChangelog } from "../src/changelog/parse.js";
import {
  CHANGELOG_FILE,
  changelogLinks,
  publishedReleases,
  readReleases,
  readableDate,
} from "../src/changelog/releases.js";
import type { DocsPage } from "../src/docs/pages.js";
import { MOKLY_PACKAGE_VERSION } from "../src/mokly-package.js";

const origin = "https://mokly.example";

/** Every release heading the file itself declares, read independently. */
function headings(): string[] {
  return readFileSync(CHANGELOG_FILE, "utf8")
    .split("\n")
    .filter((line) => /^## \[?v?\d+\.\d+/.test(line));
}

/** A changelog from its lines. */
function changelog(...lines: string[]): string {
  return lines.join("\n");
}

/** A text segment. */
function text(value: string) {
  return { kind: "text", value } as const;
}

test("every release in this repository's changelog is published", () => {
  const releases = readReleases();
  assert.equal(releases.length, headings().length);
  assert.ok(releases.length > 1, "the changelog has more than one release");
  for (const release of releases) {
    assert.match(release.version, /^\d+\.\d+\.\d+/);
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(release.groups.length > 0, release.version);
    for (const group of release.groups) {
      assert.ok(group.heading.length > 0);
      assert.ok(group.notes.length > 0, group.heading);
    }
  }
});

test("the newest release is first and keeps its link and notes", () => {
  const [newest] = readReleases();
  assert.ok(newest);
  assert.equal(newest.version, MOKLY_PACKAGE_VERSION);
  assert.match(newest.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(newest.readableDate, readableDate(newest.date));
  assert.equal(newest.anchor, releaseAnchor(MOKLY_PACKAGE_VERSION));
  assert.match(
    newest.link ?? "",
    new RegExp(`\\.\\.\\.v${MOKLY_PACKAGE_VERSION.replaceAll(".", "\\.")}$`),
  );
  assert.ok(newest.groups.some((group) => group.kind === "features"));
});

test("a heading with no link publishes no link", () => {
  const releases = parseChangelog(
    "## 0.1.0 (2026-07-20)\n\n### Features\n\n* first\n",
  );
  assert.deepEqual(releases, [
    {
      date: "2026-07-20",
      groups: [
        {
          heading: "Features",
          kind: "features",
          notes: [
            { items: [], refs: [], scope: undefined, text: [text("first")] },
          ],
        },
      ],
      link: null,
      upgrade: [],
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

test("a relative link to a published guide points at its page, and any other relative link keeps its text", () => {
  const guide: DocsPage = {
    description: "Upgrade Mokly.",
    id: "start/upgrade",
    kind: "guide",
    order: 9,
    route: "/docs/start/upgrade/",
    section: "start",
    source: "/package/docs/guides/start/upgrade.md",
    title: "Upgrade",
  };
  const resolve = changelogLinks("/package/CHANGELOG.md", [guide]);
  assert.deepEqual(
    parseNote(
      "the [guide](docs/guides/start/upgrade.md#node) and [a file](docs/other.md)",
      resolve,
    ),
    [
      text("the "),
      { href: "/docs/start/upgrade/#node", kind: "link", text: "guide" },
      text(" and "),
      text("a file"),
    ],
  );
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
  assert.deepEqual(release?.groups[0]?.notes[0]?.text, [
    { kind: "text", value: "first line second line" },
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
  assert.ok(feed.includes(`<title>Mokly CLI ${MOKLY_PACKAGE_VERSION}</title>`));
  assert.ok(feed.includes(`${origin}/changelog.xml`));
});

test("the feed escapes release text and falls back to the page anchor", () => {
  const feed = changelogFeed(
    publishedReleases(
      parseChangelog("## 0.1.0 (2026-07-20)\n\n### Features\n\n* a & b <c>\n"),
    ),
    origin,
  );
  sax.parser(true).write(feed).close();
  assert.ok(feed.includes("a &amp; b &lt;c&gt;"));
  assert.ok(feed.includes(`${origin}/changelog/#release-0-1-0`));
});

test("the feed sets each group of notes on a line and names the upgrade topics", () => {
  const feed = changelogFeed(
    publishedReleases(
      parseChangelog(
        changelog(
          "## 0.2.0 (2026-08-01)",
          "### Performance Improvements",
          "* **cli:** be quick ([#3](https://example.com/3)) ([abc1234](https://example.com/c/abc1234))",
          "### Dependencies",
          "* The following workspace dependencies were updated",
          "  * dependencies",
          "    * @mokly/viewer bumped from 0.1.0 to 0.2.0",
          "### Upgrade Notes",
          "#### First Topic",
          "Words.",
          "#### Second Topic",
          "More words.",
        ),
      ),
    ),
    origin,
  );
  assert.ok(
    feed.includes(
      [
        "<summary>Performance: cli: be quick (#3) (abc1234)",
        "Dependencies: The following workspace dependencies were updated * dependencies * @mokly/viewer bumped from 0.1.0 to 0.2.0",
        "Upgrade notes: First Topic; Second Topic</summary>",
      ].join("\n"),
    ),
    feed,
  );
});

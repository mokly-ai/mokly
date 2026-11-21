/**
 * The changelog model below the release headings: the kind of each note
 * group, the parts of a note, the upgrade notes in full, and the anchors that
 * the page gives the parts of a release. tests/changelog.test.ts holds the
 * releases, their links and the feed.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parseChangelog } from "../src/changelog/parse.js";
import { publishedReleases } from "../src/changelog/releases.js";

/** A changelog from its lines. */
function changelog(...lines: string[]): string {
  return lines.join("\n");
}

/** A text segment. */
function text(value: string) {
  return { kind: "text", value } as const;
}

test("each group heading names its kind, and an unknown heading keeps its own notes", () => {
  const [release] = parseChangelog(
    changelog(
      "## 0.2.0 (2026-08-01)",
      "### ⚠ BREAKING CHANGES",
      "* drop the old flag",
      "### Features",
      "* add a flag",
      "### Bug Fixes",
      "* fix a flag",
      "### Performance Improvements",
      "* speed up",
      "### Code Refactoring",
      "* tidy up",
      "### Documentation",
      "* explain",
      "### Dependencies",
      "* bump",
      "### Miscellaneous Chores",
      "* chore one",
      "* chore two",
    ),
  );
  assert.deepEqual(
    release?.groups.map((group) => [
      group.kind,
      group.heading,
      group.notes.length,
    ]),
    [
      ["breaking", "⚠ BREAKING CHANGES", 1],
      ["features", "Features", 1],
      ["fixes", "Bug Fixes", 1],
      ["performance", "Performance Improvements", 1],
      ["refactoring", "Code Refactoring", 1],
      ["docs", "Documentation", 1],
      ["deps", "Dependencies", 1],
      ["other", "Miscellaneous Chores", 2],
    ],
  );
  const [loose] = parseChangelog("## 0.1.0 (2026-07-20)\n\n* a loose note\n");
  assert.deepEqual(
    loose?.groups.map((group) => [group.kind, group.heading]),
    [["other", "Changes"]],
  );
});

test("a note keeps its scope, its text, its issue and commit links and its nested items", () => {
  const [release] = parseChangelog(
    changelog(
      "## 0.3.0 (2026-09-01)",
      "### Features",
      "* **viewer:** add `mokly serve` ([#12](https://example.com/issues/12)) ([abc1234](https://example.com/commit/abc1234def))",
      "### Dependencies",
      "* The following workspace dependencies were updated",
      "  * dependencies",
      "    * @mokly/viewer bumped from 0.1.0 to 0.2.0",
    ),
  );
  assert.deepEqual(release?.groups[0]?.notes, [
    {
      items: [],
      refs: [
        { href: "https://example.com/issues/12", kind: "issue", label: "#12" },
        {
          href: "https://example.com/commit/abc1234def",
          kind: "commit",
          label: "abc1234",
        },
      ],
      scope: "viewer",
      text: [text("add "), { kind: "code", value: "mokly serve" }],
    },
  ]);
  assert.deepEqual(release?.groups[1]?.notes, [
    {
      items: [
        {
          items: [
            {
              items: [],
              text: [text("@mokly/viewer bumped from 0.1.0 to 0.2.0")],
            },
          ],
          text: [text("dependencies")],
        },
      ],
      refs: [],
      scope: undefined,
      text: [text("The following workspace dependencies were updated")],
    },
  ]);
});

test("the upgrade notes keep their topics, subtopics, paragraphs and lists in full", () => {
  const [release] = parseChangelog(
    changelog(
      "## 0.4.0 (2026-10-01)",
      "### Features",
      "* add",
      "### Upgrade Notes",
      "",
      "#### First Topic",
      "",
      "A paragraph that wraps",
      "onto a second line.",
      "",
      "##### A Subtopic",
      "",
      "- One item that wraps",
      "  onto its next line.",
      "- Two with `code`.",
      "",
      "#### Second Topic",
      "",
      "Last words.",
    ),
  );
  assert.deepEqual(
    release?.groups.map((group) => group.kind),
    ["features"],
  );
  assert.deepEqual(release?.upgrade, [
    {
      blocks: [
        {
          kind: "paragraph",
          text: [text("A paragraph that wraps onto a second line.")],
        },
        { kind: "subtopic", title: [text("A Subtopic")] },
        {
          items: [
            {
              items: [],
              text: [text("One item that wraps onto its next line.")],
            },
            {
              items: [],
              text: [
                text("Two with "),
                { kind: "code", value: "code" },
                text("."),
              ],
            },
          ],
          kind: "list",
        },
      ],
      title: [text("First Topic")],
    },
    {
      blocks: [{ kind: "paragraph", text: [text("Last words.")] }],
      title: [text("Second Topic")],
    },
  ]);
});

test("each part takes an id unique on the page, and a fragment for an upgrade heading of the same release points at it", () => {
  const releases = publishedReleases(
    parseChangelog(
      changelog(
        "## 0.2.0 (2026-08-02)",
        "### Features",
        "* add",
        "### Miscellaneous Chores",
        "* tidy",
        "### Upgrade Notes",
        "#### Rust Rebuild",
        "See the [first note](#first-release).",
        "#### First Release",
        "##### Same",
        "##### Same",
        "## 0.1.0 (2026-08-01)",
        "### Features",
        "* see [the topic](#first-release) and [elsewhere](#elsewhere)",
        "### Upgrade Notes",
        "#### First Release",
        "Other words.",
      ),
    ),
  );
  const [second, first] = releases;
  assert.deepEqual(
    second?.groups.map((group) => group.id),
    ["release-0-2-0-features", "release-0-2-0-miscellaneous-chores"],
  );
  assert.equal(second?.upgradeId, "release-0-2-0-upgrade");
  assert.deepEqual(
    second?.upgrade.map((topic) => [
      topic.id,
      topic.blocks.flatMap((block) =>
        block.kind === "subtopic" ? [block.id] : [],
      ),
    ]),
    [
      ["release-0-2-0-upgrade-rust-rebuild", []],
      [
        "release-0-2-0-upgrade-first-release",
        ["release-0-2-0-upgrade-same", "release-0-2-0-upgrade-same-2"],
      ],
    ],
  );
  assert.deepEqual(second?.upgrade[0]?.blocks, [
    {
      kind: "paragraph",
      text: [
        text("See the "),
        {
          href: "#release-0-2-0-upgrade-first-release",
          kind: "link",
          text: "first note",
        },
        text("."),
      ],
    },
  ]);
  assert.deepEqual(first?.groups[0]?.notes[0]?.text, [
    text("see "),
    {
      href: "#release-0-1-0-upgrade-first-release",
      kind: "link",
      text: "the topic",
    },
    text(" and "),
    { href: "#elsewhere", kind: "link", text: "elsewhere" },
  ]);
});

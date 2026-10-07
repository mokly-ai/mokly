import assert from "node:assert/strict";
import test from "node:test";

import {
  renderReviewArtifact,
  summaryMarkdown,
} from "../dist/review/artifact.js";
import type {
  ReviewResult,
  ReviewState,
} from "../packages/viewer/dist/review/types.js";

const result: ReviewResult = {
  baseCommit: "a".repeat(40),
  baseRef: "origin/main",
  changedPaths: [],
  ignoredImpact: [],
  schemaVersion: 6 as const,
  screens: [
    {
      after: { path: "home", title: "Home" },
      before: { path: "home", title: "Home" },
      path: "home",
      title: "Home",
      state: "unchanged",
      views: [
        {
          colorScheme: "light",
          viewport: "mobile",
          state: "unchanged",
          ignoredIds: [],
        },
      ],
    },
  ],
  components: [],
  changes: [],
  affectedConsumers: [],
};

test("component summary titles are literal single-line Markdown", () => {
  const summary = summaryMarkdown({
    ...result,
    schemaVersion: 6 as const,
    screens: [],
    components: [],
    affectedConsumers: [],

    changes: [
      {
        kind: "component",
        after: {
          path: "action",
          title:
            "Action\r\n## Approved [link](https://example.com) <b> &amp; `code` *bold*",
        },
        reasons: [{ kind: "added" }],
      },
    ],
  });
  assert.equal(
    summary.split("\n").filter((line) => line.startsWith("- ")).length,
    1,
  );
  assert.ok(
    summary.includes(
      String.raw`Action \#\# Approved \[link\]\(https://example\.com\) \<b\> &amp;amp; \`code\` \*bold\*`,
    ),
  );
  assert.doesNotMatch(summary, /^## Approved/m);
});

test("comparison artifacts contain data and snapshots without a separate UI", () => {
  const snapshots = new Map([
    [
      "snapshots/before/mokly-generated/home/index.mobile.html",
      "<main>Before</main>",
    ],
    [
      "snapshots/after/mokly-generated/home/index.mobile.html",
      "<main>After</main>",
    ],
  ]);
  const files = renderReviewArtifact({ files: snapshots, result });
  assert.deepEqual(JSON.parse(String(files.get("review.json"))), result);
  assert.equal(
    files.get("snapshots/before/mokly-generated/home/index.mobile.html"),
    snapshots.get("snapshots/before/mokly-generated/home/index.mobile.html"),
  );
  assert.deepEqual([...files.keys()].sort(), [
    ".mokly-review-artifact",
    "review.json",
    "snapshots/after/mokly-generated/home/index.mobile.html",
    "snapshots/before/mokly-generated/home/index.mobile.html",
    "summary.md",
  ]);
  assert.match(String(files.get("summary.md")), /Changes: 0/);
});

test("empty comparisons still return a valid result", () => {
  const empty = { ...result, screens: [] };
  const files = renderReviewArtifact({ files: new Map(), result: empty });
  assert.deepEqual(JSON.parse(String(files.get("review.json"))), empty);
  assert.match(String(files.get("summary.md")), /Changes: 0/);
});

for (const [state, outputChanges] of [
  ["unchanged", 0],
  ["ignored-only", 0],
  ["changed", 1],
  ["added", 1],
  ["removed", 1],
] satisfies [ReviewState, number][]) {
  test(`summary counts ${state} output without source-path impact`, () => {
    const summary = summaryMarkdown({
      ...result,
      screens: result.screens.map((screen) => ({ ...screen, state })),
    });
    assert.match(summary, new RegExp(`output changes: ${outputChanges};`));
    assert.doesNotMatch(
      summary,
      /impact evidence|impact-only|Shared-impact paths/,
    );
    assert.doesNotMatch(summary, /material:/);
    assert.doesNotMatch(summary, /`styles.css`/);
  });
}

test("ignored-only output does not create impact counts", () => {
  const summary = summaryMarkdown({
    ...result,
    screens: result.screens.map((screen) => ({
      ...screen,
      state: "ignored-only",
    })),
  });
  assert.match(summary, /output changes: 0;/);
  assert.match(summary, /ignored-only: 1\./);
  assert.doesNotMatch(summary, /impact evidence|impact-only/);
});

test("summary counts a screen once when several viewport and scheme views change", () => {
  const summary = summaryMarkdown({
    ...result,
    screens: result.screens.map((screen) => ({
      ...screen,
      state: "changed",
      views: (["mobile", "desktop"] as const).flatMap((viewport) =>
        (["light", "dark"] as const).map((colorScheme) => ({
          viewport,
          colorScheme,
          state: "changed" as const,
          ignoredIds: [],
        })),
      ),
    })),
  });
  assert.match(summary, /Screens: 1; output changes: 1;/);
  assert.match(
    summary,
    /Output changes count screens with changed documents or retained resource evidence/,
  );
});

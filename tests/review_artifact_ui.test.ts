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
  schemaVersion: 2,
  sharedImpact: ["styles.css"],
  screens: [
    {
      dependencies: [],
      id: "home",
      route: "screens/home.html",
      title: "Home",
      state: "unchanged",
      sharedImpact: ["styles.css"],
      views: [
        {
          colorScheme: "light",
          viewport: "mobile",
          state: "unchanged",
          ignoredIds: [],
          beforePath: "snapshots/base/home.html",
          afterPath: "snapshots/head/home.html",
        },
      ],
    },
  ],
};

test("component summary titles are literal single-line Markdown", () => {
  const summary = summaryMarkdown({
    ...result,
    schemaVersion: 3,
    screens: [],
    components: [],
    affectedConsumers: [],
    changes: [
      {
        kind: "component",
        after: {
          id: "action",
          route: "components/action.html",
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
    ["snapshots/base/home.html", "<main>Before</main>"],
    ["snapshots/head/home.html", "<main>After</main>"],
  ]);
  const files = renderReviewArtifact({ files: snapshots, result });
  assert.deepEqual(JSON.parse(String(files.get("review.json"))), result);
  assert.equal(
    files.get("snapshots/base/home.html"),
    snapshots.get("snapshots/base/home.html"),
  );
  assert.deepEqual([...files.keys()].sort(), [
    ".mokly-review-artifact",
    "review.json",
    "snapshots/base/home.html",
    "snapshots/head/home.html",
    "summary.md",
  ]);
  assert.match(String(files.get("summary.md")), /impact-only: 1/);
});

test("empty comparisons still return a valid result", () => {
  const empty = { ...result, screens: [], sharedImpact: [] };
  const files = renderReviewArtifact({ files: new Map(), result: empty });
  assert.deepEqual(JSON.parse(String(files.get("review.json"))), empty);
  assert.match(String(files.get("summary.md")), /Screens: 0/);
});

for (const [state, outputChanges, impactOnly] of [
  ["unchanged", 0, 1],
  ["ignored-only", 0, 1],
  ["changed", 1, 0],
  ["added", 1, 0],
  ["removed", 1, 0],
] satisfies [ReviewState, number, number][]) {
  test(`summary separates ${state} output from impact evidence`, () => {
    const summary = summaryMarkdown({
      ...result,
      screens: result.screens.map((screen) => ({ ...screen, state })),
    });
    assert.match(summary, new RegExp(`output changes: ${outputChanges};`));
    assert.match(summary, /impact evidence: 1;/);
    assert.match(summary, new RegExp(`impact-only: ${impactOnly}\\.`));
    assert.doesNotMatch(summary, /material:/);
    assert.match(summary, /`styles.css`/);
  });
}

test("ignored-only output without dependencies is not impact evidence", () => {
  const summary = summaryMarkdown({
    ...result,
    sharedImpact: [],
    screens: result.screens.map((screen) => ({
      ...screen,
      state: "ignored-only",
      sharedImpact: [],
    })),
  });
  assert.match(summary, /output changes: 0;/);
  assert.match(summary, /ignored-only: 1;/);
  assert.match(summary, /impact evidence: 0; impact-only: 0\./);
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

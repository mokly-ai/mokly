import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { renderReviewArtifact } from "../dist/review/artifact.js";
import { compareReview } from "../dist/review/compare.js";
import { normalizeReviewPair } from "../dist/review/ignore.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { runReview } from "../dist/review/run.js";
import type { ReviewArtifact } from "../packages/viewer/dist/review/types.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("Comparison snapshot output cannot overlap generated or authored roots", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);

  for (const out of ["mockups/review", "entries/review"]) {
    await assert.rejects(
      () =>
        runReview(
          config,
          "HEAD",
          path.join(fixture.root, out),
          committedReviewRepository(config),
        ),
      /must not overlap/,
    );
  }
});

test("Review artifact paths are collision-free for distinct valid routes", async (context) => {
  const fixture = await createFixture(collidingRouteSource());
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const baseManifest = JSON.stringify({
    entries: [],
    generatedBy: "mokly",
    legacyPages: [],
    schemaVersion: 3,
  });
  const artifact = await compareReview(
    compilation,
    config,
    {
      evidence: {
        changedPaths: async () => [],
        mergeBase: async () => "a".repeat(40),
      },
      reader: {
        fileExists: async (_commit, repoPath) =>
          repoPath.endsWith("mokly-manifest.json"),
        fileKind: async (_commit, repoPath) =>
          repoPath.endsWith("mokly-manifest.json") ? "regular" : "missing",
        readFile: async (_commit, repoPath) => {
          if (repoPath.endsWith("mokly-manifest.json")) return baseManifest;
          throw new Error(`unexpected Git path ${repoPath}`);
        },
        readFileBytes: async (_commit, repoPath) => {
          if (repoPath.endsWith("mokly-manifest.json")) {
            return Buffer.from(baseManifest);
          }
          throw new Error(`unexpected Git path ${repoPath}`);
        },
      },
    },
    "HEAD",
  );
  const afterPaths = artifact.result.screens.flatMap((screen) =>
    screen.views.flatMap((view) => view.afterPath ?? []),
  );

  assert.equal(afterPaths.length, 4);
  assert.equal(new Set(afterPaths).size, 4);
});

test("one-sided material-signal adoption compares real children", () => {
  const key = "a".repeat(64);
  const base = ignored("nav", "<nav>Same</nav>");
  const head = `${ignored("nav", "<nav>Same</nav>")}<!--mokly-review-material:nav:${key}-->`;

  const normalized = normalizeReviewPair(base, head, "screens/home.html");

  assert.equal(normalized.base, normalized.head);
  assert.deepEqual(normalized.ignoredIds, []);
});

test("different material keys remain part of Review classification", () => {
  const base = `${ignored("nav", "<nav>Same</nav>")}<!--mokly-review-material:nav:${"a".repeat(64)}-->`;
  const head = `${ignored("nav", "<nav>Same</nav>")}<!--mokly-review-material:nav:${"b".repeat(64)}-->`;

  const normalized = normalizeReviewPair(base, head, "screens/home.html");

  assert.notEqual(normalized.base, normalized.head);
});

test("Comparison artifacts retain snapshots without standalone UI", () => {
  const artifact: ReviewArtifact = {
    files: new Map([
      ["screens/screens/home/mobile/before.html", "<html></html>"],
      ["screens/screens/home/mobile/after.html", "<html></html>"],
    ]),
    result: {
      baseCommit: "a".repeat(40),
      baseRef: "HEAD",
      changedPaths: [],
      ignoredImpact: [],
      schemaVersion: 2,
      screens: [
        {
          dependencies: [],
          id: "home",
          route: "screens/home.html",
          sharedImpact: [],
          state: "changed",
          title: "Home",
          views: [
            {
              afterPath: "screens/screens/home/mobile/after.html",
              beforePath: "screens/screens/home/mobile/before.html",
              colorScheme: "light",
              ignoredIds: [],
              state: "changed",
              viewport: "mobile",
            },
          ],
        },
      ],
      sharedImpact: [],
    },
  };
  const files = renderReviewArtifact(artifact);
  assert.equal(files.has("index.html"), false);
  assert.equal(files.has("review-navigation.js"), false);
  assert.equal(
    files.get("screens/screens/home/mobile/before.html"),
    "<html></html>",
  );
});

test("Review retains marker-bearing pane bytes as portable output", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const baseManifest = JSON.stringify({
    entries: [],
    generatedBy: "mokly",
    legacyPages: [],
    schemaVersion: 3,
  });
  const artifact = await compareReview(
    compilation,
    config,
    {
      evidence: {
        changedPaths: async () => [],
        mergeBase: async () => "a".repeat(40),
      },
      reader: {
        fileExists: async (_commit, repoPath) =>
          repoPath.endsWith("mokly-manifest.json"),
        fileKind: async (_commit, repoPath) =>
          repoPath.endsWith("mokly-manifest.json") ? "regular" : "missing",
        readFile: async () => baseManifest,
        readFileBytes: async () => Buffer.from(baseManifest),
      },
    },
    "HEAD",
  );
  const home = artifact.result.screens.find((screen) => screen.id === "home");
  const afterPath = home?.views.find(
    (view) => view.viewport === "mobile" && view.colorScheme === "light",
  )?.afterPath;
  assert.ok(afterPath);
  const pane = String(artifact.files.get(afterPath));

  assert.equal(pane, compilation.outputs.get("screens/home.mobile.html"));
  assert.match(pane, /href="\.\/details\.mobile\.html"/);
  assert.match(pane, /data-mokly-link="details"/);
  assert.doesNotMatch(pane, /data-mokly-target/);
});

function collidingRouteSource(): string {
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: ["notes.md"], relatedDocs: ["notes.md"], useCaseIds: [] };
export const mockups = [
  defineScreen({ ...metadata, description: "Dot route", desktop: <main>Dot</main>, id: "dot-route", mobile: <main>Dot</main>, route: "screens/a.b.html", title: "Dot" }),
  defineScreen({ ...metadata, description: "Hyphen route", desktop: <main>Hyphen</main>, id: "hyphen-route", mobile: <main>Hyphen</main>, route: "screens/a-b.html", title: "Hyphen" })
];
`;
}

function ignored(id: string, content: string): string {
  return `<!--mokly-review-ignore:start:${id}-->${content}<!--mokly-review-ignore:end:${id}-->`;
}

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { renderReviewArtifact } from "../dist/review/artifact.js";
import { compareReview } from "../dist/review/compare.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  fakeGit,
  filesForCompilation,
  withHomeIgnoredRegions,
  withoutDarkFragments,
} from "./helpers/review_fixtures.js";

test("dark views compare and classify against a pre-dark base", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const rawCompilation = await compileCatalogue(config);
  const compilation = withHomeIgnoredRegions(rawCompilation, "after");
  const baseCompilation = withHomeIgnoredRegions(rawCompilation, "before");
  const baseManifest = withoutDarkFragments(baseCompilation.manifest);

  const artifact = await compareReview(
    compilation,
    config,
    fakeGit(filesForCompilation(baseManifest, baseCompilation)),
    "HEAD",
  );

  const home = artifact.result.screens.find((screen) => screen.id === "home");
  assert.ok(home);
  assert.deepEqual(
    home.views.map(({ colorScheme, state, viewport }) => ({
      colorScheme,
      state,
      viewport,
    })),
    [
      { colorScheme: "light", state: "ignored-only", viewport: "mobile" },
      { colorScheme: "dark", state: "added", viewport: "mobile" },
      { colorScheme: "light", state: "ignored-only", viewport: "desktop" },
      { colorScheme: "dark", state: "added", viewport: "desktop" },
    ],
  );
  const reviewJson = JSON.parse(
    renderReviewArtifact(artifact).get("review.json") as string,
  ) as ReviewResult;
  assert.equal(reviewJson.schemaVersion, 2);
  const jsonHome = reviewJson.screens.find((screen) => screen.id === "home");
  assert.ok(jsonHome);
  assert.deepEqual(
    jsonHome.views.map(
      ({
        afterPath,
        beforePath,
        colorScheme,
        ignoredIds,
        state,
        viewport,
      }) => ({
        after: Boolean(afterPath),
        before: Boolean(beforePath),
        colorScheme,
        ignoredIds,
        state,
        viewport,
      }),
    ),
    [
      {
        after: true,
        before: true,
        colorScheme: "light",
        ignoredIds: ["nav"],
        state: "ignored-only",
        viewport: "mobile",
      },
      {
        after: true,
        before: false,
        colorScheme: "dark",
        ignoredIds: [],
        state: "added",
        viewport: "mobile",
      },
      {
        after: true,
        before: true,
        colorScheme: "light",
        ignoredIds: ["nav"],
        state: "ignored-only",
        viewport: "desktop",
      },
      {
        after: true,
        before: false,
        colorScheme: "dark",
        ignoredIds: [],
        state: "added",
        viewport: "desktop",
      },
    ],
  );
  assert.deepEqual(reviewJson.ignoredImpact, [
    { colorScheme: "light", count: 1, id: "nav", viewport: "mobile" },
    { colorScheme: "light", count: 1, id: "nav", viewport: "desktop" },
  ]);
});

test("removing dark classifies dark views removed", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const darkConfig = await loadConfig(fixture.root);
  const darkCompilation = await compileCatalogue(darkConfig);
  await fs.promises.writeFile(
    fixture.configPath,
    `import { defineConfig } from "@mokly/mokly";
export default defineConfig({
  entriesDir: "entries",
  mockupsDir: "mockups",
  repoRoot: ".",
  review: { outDir: ".review", sharedImpact: ["notes.md"] }
});
`,
  );
  const lightConfig = await loadConfig(fixture.root);
  const lightCompilation = await compileCatalogue(lightConfig);

  const artifact = await compareReview(
    lightCompilation,
    lightConfig,
    fakeGit(filesForCompilation(darkCompilation.manifest, darkCompilation)),
    "HEAD",
  );

  const home = artifact.result.screens.find((screen) => screen.id === "home");
  assert.ok(home);
  assert.deepEqual(
    home.views.map(({ colorScheme, state, viewport }) => ({
      colorScheme,
      state,
      viewport,
    })),
    [
      { colorScheme: "light", state: "unchanged", viewport: "mobile" },
      { colorScheme: "dark", state: "removed", viewport: "mobile" },
      { colorScheme: "light", state: "unchanged", viewport: "desktop" },
      { colorScheme: "dark", state: "removed", viewport: "desktop" },
    ],
  );
});

test("ignoredImpact sorts by viewport then scheme then id", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const baseCompilation = withHomeIgnoredRegions(compilation, "before", [
    "z-nav",
    "a-nav",
  ]);
  const headCompilation = withHomeIgnoredRegions(compilation, "after", [
    "z-nav",
    "a-nav",
  ]);

  const artifact = await compareReview(
    headCompilation,
    config,
    fakeGit(filesForCompilation(baseCompilation.manifest, baseCompilation)),
    "HEAD",
  );

  assert.deepEqual(artifact.result.ignoredImpact, [
    { colorScheme: "light", count: 1, id: "a-nav", viewport: "mobile" },
    { colorScheme: "light", count: 1, id: "z-nav", viewport: "mobile" },
    { colorScheme: "dark", count: 1, id: "a-nav", viewport: "mobile" },
    { colorScheme: "dark", count: 1, id: "z-nav", viewport: "mobile" },
    { colorScheme: "light", count: 1, id: "a-nav", viewport: "desktop" },
    { colorScheme: "light", count: 1, id: "z-nav", viewport: "desktop" },
    { colorScheme: "dark", count: 1, id: "a-nav", viewport: "desktop" },
    { colorScheme: "dark", count: 1, id: "z-nav", viewport: "desktop" },
  ]);
});

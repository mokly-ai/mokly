import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import type { Compilation } from "../dist/build/compile.js";
import {
  generatedBytes,
  generatedText,
  type GeneratedFile,
} from "../dist/build/generated_file.js";
import { loadConfig } from "../dist/config/load.js";
import { renderReviewArtifact } from "../dist/review/artifact.js";
import { compareReview } from "../dist/review/compare.js";
import type { ReadOnlyReviewRepository } from "../dist/review/repository.js";
import { generatedViews } from "../packages/viewer/dist/data.js";
import type {
  ManifestScreen,
  ManifestV8,
} from "../packages/viewer/dist/registry/types.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

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

  const home = artifact.result.screens.find((screen) => screen.path === "home");
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
  assert.equal(reviewJson.schemaVersion, 5);
  const jsonHome = reviewJson.screens.find((screen) => screen.path === "home");
  assert.ok(jsonHome);
  assert.deepEqual(
    jsonHome.views.map(({ colorScheme, ignoredIds, state, viewport }) => ({
      after: state !== "removed",
      before: state !== "added",
      colorScheme,
      ignoredIds,
      state,
      viewport,
    })),
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
  roots: [{ dir: "entries" }],
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

  const home = artifact.result.screens.find((screen) => screen.path === "home");
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

function fakeGit(
  files: ReadonlyMap<string, GeneratedFile>,
): ReadOnlyReviewRepository {
  return {
    evidence: {
      changedPaths: async () => [],
      mergeBase: async () => "a".repeat(40),
    },
    reader: {
      fileExists: async (_commit, repoPath) => files.has(repoPath),
      fileKind: async (_commit, repoPath) =>
        files.has(repoPath) ? "regular" : "missing",
      readFile: async (_commit, repoPath) => {
        const content = files.get(repoPath);
        if (content === undefined)
          throw new Error(`missing fake Git path ${repoPath}`);
        return generatedText(content, repoPath)!;
      },
      readFileBytes: async (_commit, repoPath) => {
        const content = files.get(repoPath);
        if (content === undefined)
          throw new Error(`missing fake Git path ${repoPath}`);
        return generatedBytes(content);
      },
    },
  };
}

function filesForCompilation(
  manifest: ManifestV8,
  compilation: Compilation,
): Map<string, GeneratedFile> {
  const files = new Map<string, GeneratedFile>([
    ["mockups/mokly-manifest.json", `${JSON.stringify(manifest)}\n`],
  ]);
  for (const [route, content] of compilation.outputs) {
    if (route === "mokly-manifest.json") continue;
    files.set(`mockups/${route}`, content);
  }
  return files;
}

function withoutDarkFragments(manifest: ManifestV8): ManifestV8 {
  return {
    ...manifest,
    entries: manifest.entries.map((entry) => {
      if (entry.kind !== "screen") return entry;
      return {
        ...entry,
        colorSchemes: ["light"],
        ...(entry.componentViews
          ? {
              componentViews: entry.componentViews.filter(
                (view) => view.colorScheme === "light",
              ),
            }
          : {}),
      };
    }),
  };
}

function withHomeIgnoredRegions(
  compilation: Compilation,
  label: string,
  ids: readonly string[] = ["nav"],
): Compilation {
  const home = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen" && entry.path === "home",
  );
  if (home?.kind !== "screen") throw new Error("missing home screen");
  const outputs = new Map(compilation.outputs);
  for (const fragment of screenFragments(home)) {
    const content = outputs.get(fragment);
    if (content === undefined) throw new Error(`missing output ${fragment}`);
    outputs.set(
      fragment,
      insertIgnoredRegions(textOutput(outputs, fragment)!, label, ids),
    );
  }
  return { ...compilation, outputs };
}

function screenFragments(screen: ManifestScreen): string[] {
  return generatedViews(screen).map((view) => view.path);
}

function insertIgnoredRegions(
  content: string,
  label: string,
  ids: readonly string[],
): string {
  const regions = ids
    .map(
      (id) =>
        `<!--mokly-review-ignore:start:${id}-->` +
        `<span>${label}-${id}</span>` +
        `<!--mokly-review-ignore:end:${id}-->`,
    )
    .join("");
  if (!content.includes("</main>")) throw new Error("missing main close tag");
  return content.replace("</main>", `${regions}</main>`);
}

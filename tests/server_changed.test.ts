import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestIds } from "../dist/registry/changed_ids.js";
import { compareReview } from "../dist/review/compare.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../dist/review/git.js";
import type { ReadOnlyReviewRepository } from "../dist/review/repository.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeChangedIds } from "../dist/server/changed.js";
import { viewRoute } from "../packages/viewer/dist/data.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { nestedRepository } from "./helpers/nested_repository.js";

const execFileAsync = promisify(execFile);

test("changed routes select fragment edits rather than source or dependency edits", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  assert.deepEqual(
    changedManifestIds(compilation.manifest, compilation.manifest, config, [
      "entries/fixture.mockup.tsx",
    ]),
    [],
  );
  assert.deepEqual(
    changedManifestIds(compilation.manifest, compilation.manifest, config, [
      "notes.md",
    ]),
    [],
  );
  assert.deepEqual(
    changedManifestIds(compilation.manifest, compilation.manifest, config, [
      "mockups/screens/home.mobile.html",
    ]),
    ["home", "tour"],
  );
  assert.deepEqual(
    changedManifestIds(compilation.manifest, compilation.manifest, config, [
      "unrelated.txt",
    ]),
    [],
  );
});

test("manifest entry changes are attributed to their route", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;
  const baseManifest = structuredClone(manifest);
  const baseHome = baseManifest.entries.find((entry) => entry.id === "home");
  if (!baseHome) throw new Error("fixture base home missing");
  baseHome.title = "Previous home";

  assert.deepEqual(
    changedManifestIds(manifest, baseManifest, config, [
      "entries/fixture.mockup.tsx",
      "mockups/mokly-manifest.json",
    ]),
    ["home", "tour"],
  );
});

test("tag-only manifest changes mark their route as changed", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;

  const taggedScreenBase = structuredClone(manifest);
  const baseDetails = taggedScreenBase.entries.find(
    (entry) => entry.id === "details",
  );
  if (baseDetails?.kind !== "screen") {
    throw new Error("fixture base details missing");
  }
  baseDetails.tags = ["forms"];
  assert.deepEqual(changedManifestIds(manifest, taggedScreenBase, config, []), [
    "details",
    "tour",
  ]);

  const taggedUseCaseBase = structuredClone(manifest);
  const baseTour = taggedUseCaseBase.entries.find(
    (entry) => entry.id === "tour",
  );
  if (baseTour?.kind !== "use-case")
    throw new Error("fixture base tour missing");
  baseTour.tags = ["onboarding"];
  assert.deepEqual(
    changedManifestIds(manifest, taggedUseCaseBase, config, []),
    ["tour"],
  );
});

test("a changed navigation path marks each moved route", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;
  const baseManifest = structuredClone(manifest);
  for (const entry of baseManifest.entries)
    entry.navPath = ["Historical label"];

  assert.deepEqual(
    changedManifestIds(manifest, baseManifest, config, []),
    manifest.entries.map((entry) => entry.id).sort(),
  );
});

test("changed screens propagate to use cases authored separately", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = structuredClone((await compileCatalogue(config)).manifest);
  const home = manifest.entries.find((entry) => entry.id === "home");
  const tour = manifest.entries.find((entry) => entry.id === "tour");
  if (!home || home.kind !== "screen" || !tour || tour.kind !== "use-case") {
    throw new Error("fixture entries missing");
  }
  home.sourcePath = "entries/home.mockup.tsx";
  home.declaredDependencies = [];
  tour.sourcePath = "entries/tour.mockup.tsx";
  tour.declaredDependencies = [];

  assert.deepEqual(
    changedManifestIds(manifest, manifest, config, [
      `mockups/${viewRoute("screen", home.id, "mobile", "light")}`,
    ]),
    ["home", "tour"],
  );
});

test("shared entry changes do not mark unchanged sibling screens", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;
  const home = manifest.entries.find((entry) => entry.id === "home");
  if (!home || home.kind !== "screen") throw new Error("fixture home missing");

  assert.deepEqual(
    changedManifestIds(manifest, manifest, config, [
      home.sourcePath,
      `mockups/${viewRoute("screen", home.id, "mobile", "light")}`,
    ]),
    ["home", "tour"],
  );
});

test("branch comparisons exclude commits made only on the base branch", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  await git(fixture.root, ["init", "-q", "-b", "main"]);
  await git(fixture.root, ["config", "user.name", "Mokly Test"]);
  await git(fixture.root, ["config", "user.email", "mokly@example.invalid"]);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: common catalogue"]);
  const commonCommit = (await git(fixture.root, ["rev-parse", "HEAD"])).trim();

  await git(fixture.root, ["checkout", "-qb", "feature"]);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({ body: "<p>Feature-only home</p>" }),
  );
  await writeCompilation(await compileCatalogue(config), config);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: change feature home"]);

  await git(fixture.root, ["checkout", "-q", "main"]);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource().replaceAll(">Detail<", ">Main-only detail<"),
  );
  await writeCompilation(await compileCatalogue(config), config);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: change main details"]);
  await git(fixture.root, ["checkout", "-q", "feature"]);

  const client = new CommittedRepository(
    new NodeGitCommandRunner(fixture.root),
  );
  const changed = await computeChangedIds(config, "main", client);
  const review = await compareReview(
    await compileCatalogue(config),
    config,
    client,
    "main",
  );

  assert.deepEqual(changed, ["home", "tour"]);
  assert.equal(review.result.baseCommit, commonCommit);
  assert.equal(
    review.result.screens.find((screen) => screen.id === "details")?.state,
    "unchanged",
  );
});

test("directory dependency edits alone leave unchanged routes out of Changes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = structuredClone((await compileCatalogue(config)).manifest);
  const home = manifest.entries.find((entry) => entry.id === "home");
  if (!home) throw new Error("fixture home entry missing");
  home.declaredDependencies = ["src/components"];

  assert.deepEqual(
    changedManifestIds(manifest, manifest, config, [
      "src/components/Button.tsx",
    ]),
    [],
  );
});

test("changed routes require the config repo root to be the Git top level", async (context) => {
  const { config } = await nestedRepository(context);
  await assert.rejects(
    () => computeChangedIds(config, "HEAD", committedReviewRepository(config)),
    { code: "config-invalid" },
  );
});

test("changed-route detection degrades to undefined when Git fails", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  const failing: ReadOnlyReviewRepository = {
    evidence: {
      changedPaths: () => Promise.reject(new Error("no repository")),
      mergeBase: () => Promise.reject(new Error("no repository")),
    },
    reader: {
      fileExists: () => Promise.reject(new Error("no repository")),
      fileKind: () => Promise.reject(new Error("no repository")),
      readFile: () => Promise.reject(new Error("no repository")),
      readFileBytes: () => Promise.reject(new Error("no repository")),
    },
  };
  assert.equal(
    await computeChangedIds(config, "origin/main", failing),
    undefined,
  );
  const succeeding: ReadOnlyReviewRepository = {
    ...failing,
    evidence: {
      ...failing.evidence,
      changedPaths: () => Promise.resolve(["notes.md"]),
      mergeBase: () => Promise.resolve("a".repeat(40)),
    },
    reader: {
      fileExists: async (_commit, repoPath) =>
        repoPath === "mockups/mokly-manifest.json" ||
        compilation.outputs.has(repoPath.replace(/^mockups\//, "")),
      fileKind: async (_commit, repoPath) =>
        repoPath === "mockups/mokly-manifest.json" ||
        compilation.outputs.has(repoPath.replace(/^mockups\//, ""))
          ? "regular"
          : "missing",
      readFile: async (_commit, repoPath) =>
        repoPath === "mockups/mokly-manifest.json"
          ? JSON.stringify(compilation.manifest)
          : compilation.outputs.get(repoPath.replace(/^mockups\//, ""))!,
      readFileBytes: async (_commit, repoPath) =>
        Buffer.from(
          repoPath === "mockups/mokly-manifest.json"
            ? JSON.stringify(compilation.manifest)
            : compilation.outputs.get(repoPath.replace(/^mockups\//, ""))!,
        ),
    },
  };
  assert.deepEqual(
    await computeChangedIds(config, "origin/main", succeeding),
    [],
  );
});

async function git(
  cwd: string,
  arguments_: readonly string[],
): Promise<string> {
  return (await execFileAsync("git", [...arguments_], { cwd })).stdout;
}

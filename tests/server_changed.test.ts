import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { promisify } from "node:util";

import { baselineCatalogue } from "../dist/baseline/catalogue.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestPaths } from "../dist/registry/changed_paths.js";
import { compareReview } from "../dist/review/compare.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import type { ReadOnlyReviewRepository } from "../dist/review/repository.js";
import { computeChangedPaths } from "../dist/server/changed.js";
import { viewRoute } from "../packages/viewer/dist/data.js";

import { committedReviewRepository } from "./helpers/committed_repository.js";
import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";
import { nestedRepository } from "./helpers/nested_repository.js";

const execFileAsync = promisify(execFile);

test("tag-only manifest changes mark their route as changed", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;

  const taggedScreenBase = structuredClone(manifest);
  const baseDetails = taggedScreenBase.entries.find(
    (entry) => entry.path === "details",
  );
  if (baseDetails?.kind !== "screen") {
    throw new Error("fixture base details missing");
  }
  baseDetails.tags = ["forms"];
  assert.deepEqual(
    changedManifestPaths(manifest, taggedScreenBase, config, []),
    ["details", "tour"],
  );

  const taggedUseCaseBase = structuredClone(manifest);
  const baseTour = taggedUseCaseBase.entries.find(
    (entry) => entry.path === "tour",
  );
  if (baseTour?.kind !== "use-case")
    throw new Error("fixture base tour missing");
  baseTour.tags = ["onboarding"];
  assert.deepEqual(
    changedManifestPaths(manifest, taggedUseCaseBase, config, []),
    ["tour"],
  );
});

test("a changed path marks each added entry", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;
  const baseManifest = structuredClone(manifest);
  for (const entry of baseManifest.entries)
    entry.path = `historical/${entry.path}`;

  assert.deepEqual(
    changedManifestPaths(manifest, baseManifest, config, []),
    manifest.entries.map((entry) => entry.path).sort(),
  );
});

test("changed screens propagate to use cases authored separately", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = structuredClone((await compileCatalogue(config)).manifest);
  const home = manifest.entries.find((entry) => entry.path === "home");
  const tour = manifest.entries.find((entry) => entry.path === "tour");
  if (!home || home.kind !== "screen" || !tour || tour.kind !== "use-case") {
    throw new Error("fixture entries missing");
  }
  home.sourcePath = "entries/home.mockup.tsx";
  tour.sourcePath = "entries/tour.mockup.tsx";

  assert.deepEqual(
    changedManifestPaths(manifest, manifest, config, [
      `mockups/mokly-generated/${viewRoute(home.path, "mobile", "light")}`,
    ]),
    ["home", "tour"],
  );
});

test("shared entry changes do not mark unchanged sibling screens", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;
  const home = manifest.entries.find((entry) => entry.path === "home");
  if (!home || home.kind !== "screen") throw new Error("fixture home missing");

  assert.deepEqual(
    changedManifestPaths(manifest, manifest, config, [
      home.sourcePath,
      `mockups/mokly-generated/${viewRoute(home.path, "mobile", "light")}`,
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

  const client = committedReviewRepository(
    config,
    new NodeGitCommandRunner(fixture.root),
    commonCommit,
  );
  const changed = await computeChangedPaths(config, "main", client);
  const review = await compareReview(
    await compileCatalogue(config),
    config,
    client,
    "main",
  );

  assert.deepEqual(changed, ["home", "tour"]);
  assert.equal(review.result.baseCommit, commonCommit);
  assert.equal(
    review.result.screens.find((screen) => screen.path === "details")?.state,
    "unchanged",
  );
});

test("unrendered source edits alone leave unchanged routes out of Changes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = structuredClone((await compileCatalogue(config)).manifest);
  const home = manifest.entries.find((entry) => entry.path === "home");
  if (!home) throw new Error("fixture home entry missing");

  assert.deepEqual(
    changedManifestPaths(manifest, manifest, config, [
      "src/components/Button.tsx",
    ]),
    [],
  );
});

test("changed routes require the config repo root to be the Git top level", async (context) => {
  const { config } = await nestedRepository(context);
  await assert.rejects(
    () =>
      computeChangedPaths(config, "HEAD", committedReviewRepository(config)),
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
    await computeChangedPaths(config, "origin/main", failing),
    undefined,
  );
  const succeeding: ReadOnlyReviewRepository = {
    ...failing,
    descriptor: baselineCatalogue("a".repeat(40), "mockups", "generated-v9"),
    evidence: {
      ...failing.evidence,
      changedPaths: () => Promise.resolve(["notes.md"]),
      mergeBase: () => Promise.resolve("a".repeat(40)),
    },
    reader: {
      fileExists: async (_commit, repoPath) =>
        repoPath === "mockups/mokly-generated/mokly-manifest.json" ||
        compilation.outputs.has(
          repoPath.replace(/^mockups\/mokly-generated\//, ""),
        ),
      fileKind: async (_commit, repoPath) =>
        repoPath === "mockups/mokly-generated/mokly-manifest.json" ||
        compilation.outputs.has(
          repoPath.replace(/^mockups\/mokly-generated\//, ""),
        )
          ? "regular"
          : "missing",
      readFile: async (_commit, repoPath) =>
        repoPath === "mockups/mokly-generated/mokly-manifest.json"
          ? JSON.stringify(compilation.manifest)
          : textOutput(
              compilation.outputs,
              repoPath.replace(/^mockups\/mokly-generated\//, ""),
            )!,
      readFileBytes: async (_commit, repoPath) =>
        Buffer.from(
          repoPath === "mockups/mokly-generated/mokly-manifest.json"
            ? JSON.stringify(compilation.manifest)
            : compilation.outputs.get(
                repoPath.replace(/^mockups\/mokly-generated\//, ""),
              )!,
        ),
    },
  };
  assert.deepEqual(
    await computeChangedPaths(config, "origin/main", succeeding),
    [],
  );
});

async function git(
  cwd: string,
  arguments_: readonly string[],
): Promise<string> {
  return (await execFileAsync("git", [...arguments_], { cwd })).stdout;
}

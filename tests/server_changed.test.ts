import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestRoutes } from "../dist/registry/changed_routes.js";
import { compareReview } from "../dist/review/compare.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../dist/review/git.js";
import type { ReadOnlyReviewRepository } from "../dist/review/repository.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeChangedRoutes } from "../dist/server/changed.js";

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
    changedManifestRoutes(compilation.manifest, compilation.manifest, config, [
      "entries/fixture.mockup.tsx",
    ]),
    [],
  );
  assert.deepEqual(
    changedManifestRoutes(compilation.manifest, compilation.manifest, config, [
      "notes.md",
    ]),
    [],
  );
  assert.deepEqual(
    changedManifestRoutes(compilation.manifest, compilation.manifest, config, [
      "mockups/screens/home.mobile.html",
    ]),
    ["screens/home.html", "user-flows/tour.html"],
  );
  assert.deepEqual(
    changedManifestRoutes(compilation.manifest, compilation.manifest, config, [
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
    changedManifestRoutes(manifest, baseManifest, config, [
      "entries/fixture.mockup.tsx",
      "mockups/mokly-manifest.json",
    ]),
    ["screens/home.html", "user-flows/tour.html"],
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
  assert.deepEqual(
    changedManifestRoutes(manifest, taggedScreenBase, config, []),
    ["screens/details.html", "user-flows/tour.html"],
  );

  const taggedUseCaseBase = structuredClone(manifest);
  const baseTour = taggedUseCaseBase.entries.find(
    (entry) => entry.id === "tour",
  );
  if (baseTour?.kind !== "use-case")
    throw new Error("fixture base tour missing");
  baseTour.tags = ["onboarding"];
  assert.deepEqual(
    changedManifestRoutes(manifest, taggedUseCaseBase, config, []),
    ["user-flows/tour.html"],
  );
});

test("compatibility nav paths do not mark routes as changed", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;
  const baseManifest = structuredClone(manifest);
  for (const entry of baseManifest.entries) {
    if (entry.kind !== "collection") entry.navPath = ["Historical label"];
  }

  assert.deepEqual(
    changedManifestRoutes(manifest, baseManifest, config, []),
    [],
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
  home.dependencies = [home.sourcePath];
  tour.sourcePath = "entries/tour.mockup.tsx";
  tour.dependencies = [tour.sourcePath];

  assert.deepEqual(
    changedManifestRoutes(manifest, manifest, config, [
      `mockups/${home.fragments.mobile}`,
    ]),
    ["screens/home.html", "user-flows/tour.html"],
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
    changedManifestRoutes(manifest, manifest, config, [
      home.sourcePath,
      `mockups/${home.fragments.mobile}`,
    ]),
    ["screens/home.html", "user-flows/tour.html"],
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
  const changed = await computeChangedRoutes(config, "main", client);
  const review = await compareReview(
    await compileCatalogue(config),
    config,
    client,
    "main",
  );

  assert.deepEqual(changed, ["screens/home.html", "user-flows/tour.html"]);
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
  home.dependencies = ["src/components"];

  assert.deepEqual(
    changedManifestRoutes(manifest, manifest, config, [
      "src/components/Button.tsx",
    ]),
    [],
  );
});

test("changed routes require the config repo root to be the Git top level", async (context) => {
  const { config } = await nestedRepository(context);
  await assert.rejects(
    () =>
      computeChangedRoutes(config, "HEAD", committedReviewRepository(config)),
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
    await computeChangedRoutes(config, "origin/main", failing),
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
      ...failing.reader,
      fileExists: () => Promise.resolve(true),
      fileKind: () => Promise.resolve("regular"),
      readFile: () => Promise.resolve(JSON.stringify(compilation.manifest)),
      readFileBytes: (_commit, file) =>
        Promise.resolve(
          Buffer.from(
            compilation.outputs.get(file.slice("mockups/".length)) ?? "",
          ),
        ),
    },
  };
  assert.deepEqual(
    await computeChangedRoutes(config, "origin/main", succeeding),
    [],
  );
});

async function git(
  cwd: string,
  arguments_: readonly string[],
): Promise<string> {
  return (await execFileAsync("git", [...arguments_], { cwd })).stdout;
}

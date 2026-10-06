import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../packages/mokly/dist/config/load.js";
import { compareReview } from "../packages/mokly/dist/review/compare.js";
import { CommittedRepository } from "../packages/mokly/dist/review/git.js";
import type { ReadOnlyReviewRepository } from "../packages/mokly/dist/review/repository.js";
import { runReview } from "../packages/mokly/dist/review/run.js";
import type { ManifestScreen } from "../packages/viewer/dist/registry/types.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

const execFileAsync = promisify(execFile);

test("compilation rejects malformed Review-ignore output", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.root, "renderer.ts"),
    `export default function render() {
  return '<!doctype html><html><body><!--mokly-review-ignore:start:nav--><nav>Menu</nav></body></html>';
}
`,
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { roots: [{ dir: "entries" }], mockupsDir: "mockups", renderer: "renderer.ts", repoRoot: "." };
`,
  );
  const config = await loadConfig(fixture.root);

  await assert.rejects(
    () => compileCatalogue(config),
    /region nav has no end marker/,
  );
});

test("Review validates malformed markers on added and removed panes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const malformed =
    "<html><body><!--mokly-review-ignore:start:nav--><nav>Menu</nav></body></html>";
  const emptyBase = manifest([]);
  const addedOutputs = new Map(compilation.outputs);
  addedOutputs.set("home/index.mobile.html", malformed);

  await assert.rejects(
    () =>
      compareReview(
        { ...compilation, outputs: addedOutputs },
        config,
        fakeGit(
          new Map([["mockups/mokly-manifest.json", JSON.stringify(emptyBase)]]),
        ),
        "HEAD",
      ),
    /region nav has no end marker/,
  );

  const home = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen" && entry.path === "home",
  );
  assert.ok(home?.kind === "screen");
  const removed = {
    ...home,
    path: "removed",
    useCasePaths: [],
  };
  const removedFiles = new Map([
    ["mockups/mokly-manifest.json", JSON.stringify(manifest([removed]))],
    ["mockups/removed/index.mobile.html", malformed],
    ["mockups/removed/index.desktop.html", "<html><body>Old</body></html>"],
  ]);

  await assert.rejects(
    () => compareReview(compilation, config, fakeGit(removedFiles), "HEAD"),
    /region nav has no end marker/,
  );
});

test("Review excludes its active artifact directory from changed paths", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  await git(fixture.root, ["init", "-q"]);
  await git(fixture.root, ["config", "user.name", "Mokly Test"]);
  await git(fixture.root, ["config", "user.email", "mokly@example.invalid"]);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: base"]);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({ firstTitle: "Changed" }),
  );
  await writeCompilation(await compileCatalogue(config), config);
  const realReviewParent = path.join(fixture.root, "review-target");
  const reviewLink = path.join(fixture.root, "review-link");
  await fs.promises.mkdir(realReviewParent);
  await fs.promises.symlink("review-target", reviewLink);
  await git(fixture.root, ["add", "review-link"]);
  await git(fixture.root, ["commit", "-qm", "test: add review link"]);
  const outDir = path.join(reviewLink, "artifact");
  const client = new CommittedRepository({
    run: (arguments_) => gitOutput(fixture.root, arguments_),
    runBytes: (arguments_) => gitBytes(fixture.root, arguments_),
  });

  await runReview(config, "HEAD", outDir, client);
  const second = await runReview(config, "HEAD", outDir, client);

  assert.equal(
    second.changedPaths.some(
      (changed) =>
        changed === "review-target/artifact" ||
        changed.startsWith("review-target/artifact/"),
    ),
    false,
  );
});

test("Git changed-path collection uses and enforces output exclusions", async () => {
  const calls: string[][] = [];
  const client = new CommittedRepository({
    run: async (arguments_) => {
      calls.push([...arguments_]);
      return arguments_[0] === "diff"
        ? "notes.md\nreview-output/index.html\n"
        : "review-output/review.json\n";
    },
  });

  const changed = await client.evidence.changedPaths("a".repeat(40), [
    "review-output",
  ]);

  assert.deepEqual(changed, ["notes.md"]);
  assert.equal(
    calls.every((arguments_) =>
      arguments_.includes(":(exclude,top,literal)review-output"),
    ),
    true,
  );
});

test("Git file classification uses a literal pathspec", async () => {
  const calls: string[][] = [];
  const client = new CommittedRepository({
    run: async (arguments_) => {
      calls.push([...arguments_]);
      return "120000\n";
    },
  });

  const kind = await client.reader.fileKind(
    "a".repeat(40),
    "mockups/assets/[linked].css",
  );

  assert.equal(kind, "symlink");
  assert.equal(
    calls[0]?.includes(":(literal)mockups/assets/[linked].css"),
    true,
  );
});

function fakeGit(files: ReadonlyMap<string, string>): ReadOnlyReviewRepository {
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
        const value = files.get(repoPath);
        if (value === undefined)
          throw new Error(`missing fake Git path ${repoPath}`);
        return value;
      },
      readFileBytes: async (_commit, repoPath) => {
        const value = files.get(repoPath);
        if (value === undefined)
          throw new Error(`missing fake Git path ${repoPath}`);
        return Buffer.from(value);
      },
    },
  };
}

function manifest(entries: readonly ManifestScreen[]) {
  return {
    entries,
    generatedBy: "mokly",
    schemaVersion: 8 as const,
    folders: [],
    sourceFiles: [...new Set(entries.map((entry) => entry.sourcePath))].sort(),
  };
}

async function git(cwd: string, arguments_: readonly string[]): Promise<void> {
  await execFileAsync("git", [...arguments_], { cwd });
}

async function gitOutput(
  cwd: string,
  arguments_: readonly string[],
): Promise<string> {
  return (await execFileAsync("git", [...arguments_], { cwd })).stdout;
}

async function gitBytes(
  cwd: string,
  arguments_: readonly string[],
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [...arguments_],
      { cwd, encoding: "buffer" },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(Buffer.from(stdout));
      },
    );
  });
}

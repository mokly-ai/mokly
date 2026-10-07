import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { RebuiltBaselineReader } from "../dist/baseline/reader.js";
import { parseHistoricalManifest } from "../dist/registry/manifest.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";

import {
  createCommittedExampleBaseline,
  createExampleBaseline,
} from "./helpers/example_baseline.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("committed example fixtures remove the complete multiline baseline recipe", async (context) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/example-committed-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = await createCommittedExampleBaseline(root, "ordinary-preview");
  assert.deepEqual(config.review.baselineBuild, [
    ["npm", "ci"],
    [
      "npx",
      "--no-install",
      "mokly",
      "build",
      "--config",
      "examples/basic/mokly.config.ts",
    ],
  ]);
});

test("the example fixture rebuilds an untracked baseline from its own source and lockfile", async (t) => {
  await fs.mkdir(path.join(repositoryRoot, ".context"), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/example-baseline-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = await createExampleBaseline(root);
  assert.equal(
    await fs.readFile(path.join(root, "turbo.json"), "utf8"),
    await fs.readFile(path.join(repositoryRoot, "turbo.json"), "utf8"),
  );
  await fs.access(path.join(root, "scripts/clean.mjs"));
  const tracked = (
    await execute("git", ["ls-files", "examples/basic"], {
      cwd: root,
    })
  ).stdout
    .trim()
    .split("\n")
    .filter((file) => file.endsWith(".css"));
  assert.equal(tracked.length, 34);
  const manifestPath = path.join(config.generatedDir, "mokly-manifest.json");
  await assert.rejects(fs.access(manifestPath), { code: "ENOENT" });
  const prepared = await prepareReviewRepository(config, "HEAD");
  assert.ok(prepared.reader instanceof RebuiltBaselineReader);
  const manifest = parseHistoricalManifest(
    JSON.parse(
      await prepared.reader.readFile(
        prepared.commit,
        "examples/basic/mokly-generated/mokly-manifest.json",
      ),
    ),
  );
  assert.ok(
    manifest.entries.some((entry) => entry.path === "example/screens/welcome"),
  );
  await prepared.assertUnchanged();
  await assert.rejects(fs.access(manifestPath), { code: "ENOENT" });
});

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { RebuiltBaselineReader } from "../dist/baseline/reader.js";
import { parseHistoricalManifest } from "../dist/registry/manifest.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";

import { createExampleBaseline } from "./helpers/example_baseline.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("the example fixture rebuilds an untracked baseline from its own source and lockfile", async (t) => {
  await fs.mkdir(path.join(repositoryRoot, ".context"), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/example-baseline-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = await createExampleBaseline(root);
  const tracked = (
    await execute("git", ["ls-files", "examples/basic"], {
      cwd: root,
    })
  ).stdout
    .trim()
    .split("\n")
    .filter((file) => file.endsWith(".css"));
  assert.equal(tracked.length, 28);
  const manifestPath = path.join(config.generatedDir, "mokly-manifest.json");
  await assert.rejects(fs.access(manifestPath), { code: "ENOENT" });
  const prepared = await prepareReviewRepository(config, "HEAD");
  assert.ok(prepared.reader instanceof RebuiltBaselineReader);
  const manifest = parseHistoricalManifest(
    JSON.parse(
      await prepared.reader.readFile(
        prepared.commit,
        "examples/basic/.generated/mokly-manifest.json",
      ),
    ),
  );
  assert.ok(manifest.entries.some((entry) => entry.id === "example-welcome"));
  await prepared.assertUnchanged();
  await assert.rejects(fs.access(manifestPath), { code: "ENOENT" });
});

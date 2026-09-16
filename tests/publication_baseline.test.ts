import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { createPreviewComparisonFixture } from "./helpers/preview_comparison_fixture.js";

const execute = promisify(execFile);

test("publication pins one baseline for Changes and comparisons when its ref advances", async (context) => {
  const fixture = await createPreviewComparisonFixture();
  context.after(() => fixture.close());
  const baseline = (
    await fixture.git("rev-parse", "origin/main")
  ).stdout.trim();
  await fixture.git("add", ".");
  await fixture.git("commit", "-qm", "test: current catalogue");
  await execute(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { execFileSync } from "node:child_process";
       import { loadConfig } from "./dist/config/load.js";
       import { GitRepositoryEvidence } from "./dist/review/git_evidence.js";
       import { buildPreview } from "./scripts/preview/catalogue.mjs";
       const config = await loadConfig(process.argv[1]);
       const original = GitRepositoryEvidence.prototype.mergeBase;
       let calls = 0;
       GitRepositoryEvidence.prototype.mergeBase = async function (...args) {
         if (++calls !== 1) throw new Error("baseline resolved more than once");
         const commit = await original.apply(this, args);
         execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], { cwd: config.repoRoot });
         return commit;
       };
       await buildPreview(config, process.argv[2], { includeChanges: true });
       if (calls !== 1) throw new Error("baseline was not resolved");`,
      fixture.root,
      fixture.output,
    ],
    { cwd: repositoryRoot },
  );
  assert.notEqual(
    (await fixture.git("rev-parse", "origin/main")).stdout.trim(),
    baseline,
  );
  const read = (file: string) =>
    fs.promises.readFile(path.join(fixture.output, file), "utf8");
  const jsonPath = (await read("_redirects")).match(
    /^\/__mokly\/diffs\/review.json \/(\S+) 302$/m,
  )?.[1];
  assert.ok(jsonPath);
  const review: ReviewResult = JSON.parse(await read(jsonPath));
  assert.equal(review.baseCommit, baseline);
  assert.match(
    await read(
      `${path.dirname(jsonPath)}/snapshots/before/screens/home.desktop.html`,
    ),
    /Previous home/,
  );
  assert.match(
    await read("view/removed-document.html"),
    /This page was removed/,
  );
  assert.match(await read("index.html"), /data-removed-page/);
});

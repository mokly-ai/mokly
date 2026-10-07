import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { loadConfig } from "../dist/config/load.js";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  buildNestedBaseline,
  commitBaselineInputs,
  directBaselineCommands,
  useLegacyBuildScripts,
} from "./helpers/turbo_baseline.js";
import { createTurboFixture } from "./helpers/turbo_fixture.js";

const execute = promisify(execFile);

test("linked-worktree baselines build each commit's package and viewer without Turbo", async (context) => {
  const config = await loadConfig(
    repositoryRoot,
    "examples/basic/mokly.config.ts",
  );
  assert.deepEqual(config.review.baselineBuild, directBaselineCommands);
  const packageMetadata = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  const viewerMetadata = JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, "packages/viewer/package.json"),
      "utf8",
    ),
  ) as { scripts: Record<string, string> };
  assert.equal(
    packageMetadata.scripts["build:package"],
    "node scripts/clean.mjs --package @mokly/mokly && tsc --project tsconfig.build.json && node scripts/copy-assets.mjs",
  );
  assert.equal(
    viewerMetadata.scripts.build,
    "node ../../scripts/clean.mjs --package @mokly/viewer && tsc --project tsconfig.build.json && node scripts/build.mjs",
  );
  assert.equal(
    packageMetadata.scripts["example:build"],
    directBaselineCommands[4].join(" "),
  );
  const root = await createTurboFixture(context);
  const packageSource = path.join(root, "src/index.ts");
  const viewerSource = path.join(root, "packages/viewer/src/index.ts");
  const originalPackage = await fs.readFile(packageSource);
  const originalViewer = await fs.readFile(viewerSource);
  const currentMetadata = await fs.readFile(path.join(root, "package.json"));
  const currentLock = await fs.readFile(path.join(root, "package-lock.json"));
  const currentTurbo = await fs.readFile(path.join(root, "turbo.json"));
  const currentViewerMetadata = await fs.readFile(
    path.join(root, "packages/viewer/package.json"),
  );

  await useLegacyBuildScripts(root);
  const legacyCommit = await commitBaselineInputs(
    root,
    "test: pre-turbo baseline",
  );
  const linked = path.join(root, ".context/linked");
  await execute("git", ["worktree", "add", "--detach", linked, legacyCommit], {
    cwd: root,
  });
  const legacy = await buildNestedBaseline(
    root,
    linked,
    legacyCommit,
    config.review.baselineBuild!,
  );

  await fs.writeFile(path.join(root, "package.json"), currentMetadata);
  await fs.writeFile(path.join(root, "package-lock.json"), currentLock);
  await fs.writeFile(path.join(root, "turbo.json"), currentTurbo);
  await fs.writeFile(
    path.join(root, "packages/viewer/package.json"),
    currentViewerMetadata,
  );
  const currentCommit = await commitBaselineInputs(
    root,
    "test: current baseline",
  );
  const current = await buildNestedBaseline(
    root,
    linked,
    currentCommit,
    config.review.baselineBuild!,
  );
  for (const file of ["dist/index.js", "packages/viewer/dist/index.js"])
    assert.deepEqual(
      await fs.readFile(path.join(current, file)),
      await fs.readFile(path.join(legacy, file)),
    );
  await fs.appendFile(
    packageSource,
    '\nexport const baselinePackageProof = "package changed";\n',
  );
  const packageCommit = await commitBaselineInputs(
    root,
    "test: package baseline changed",
  );
  assert.equal(
    (
      await execute(
        "git",
        ["diff", "--name-only", currentCommit, packageCommit],
        { cwd: root },
      )
    ).stdout.trim(),
    "src/index.ts",
  );
  const changedPackage = await buildNestedBaseline(
    root,
    linked,
    packageCommit,
    config.review.baselineBuild!,
  );
  assert.notEqual(
    await fs.readFile(path.join(changedPackage, "dist/index.js"), "utf8"),
    await fs.readFile(path.join(current, "dist/index.js"), "utf8"),
  );

  await fs.writeFile(packageSource, originalPackage);
  await fs.appendFile(
    viewerSource,
    '\nexport const baselineViewerProof = "viewer changed";\n',
  );
  const viewerCommit = await commitBaselineInputs(
    root,
    "test: viewer baseline changed",
  );
  assert.equal(
    (
      await execute(
        "git",
        ["diff", "--name-only", currentCommit, viewerCommit],
        { cwd: root },
      )
    ).stdout.trim(),
    "packages/viewer/src/index.ts",
  );
  const changedViewer = await buildNestedBaseline(
    root,
    linked,
    viewerCommit,
    config.review.baselineBuild!,
  );
  assert.notEqual(
    await fs.readFile(
      path.join(changedViewer, "packages/viewer/dist/index.js"),
      "utf8",
    ),
    await fs.readFile(
      path.join(current, "packages/viewer/dist/index.js"),
      "utf8",
    ),
  );
  await fs.writeFile(viewerSource, originalViewer);
  for (const directory of [
    root,
    linked,
    legacy,
    current,
    changedPackage,
    changedViewer,
  ])
    await assert.rejects(fs.access(path.join(directory, ".turbo/cache")), {
      code: "ENOENT",
    });
});

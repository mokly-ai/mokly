import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, realpath, symlink } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { GENERATED_DIRECTORY, VIEWER_DIRECTORY } from "@mokly/viewer/data";

import { outputDirectory, repository } from "./generated-output-fixture";
import { policyFixture } from "./policy-fixture";

/** The catalogue's sources and tooling, which the gate's lint must read. */
const sources = [
  "docs/mockups/src/entries/probe.mockup.tsx",
  "docs/mockups/src/screens/probe-screen.tsx",
  "docs/mockups/src/_tests_/probe.test.ts",
  "apps/mockups/src/probe.ts",
];

/**
 * Mokly's build output, which holds the viewer's own scripts, and the output
 * and cache of earlier releases, which only Git's ignore rules name.
 */
const output = [
  outputDirectory + "/" + VIEWER_DIRECTORY + "/client/probe.js",
  "docs/mockups/" + GENERATED_DIRECTORY + "/probe.js",
  ".mokly-cache/probe.js",
];

/** The `lint` script of a package manifest. */
function lintScript(manifest: unknown): string {
  assert.ok(typeof manifest === "object" && manifest !== null);
  assert.ok("scripts" in manifest);
  const { scripts } = manifest;
  assert.ok(typeof scripts === "object" && scripts !== null);
  assert.ok("lint" in scripts && typeof scripts.lint === "string");
  return scripts.lint;
}

/** The files, relative to `root`, that a JSON lint report flags. */
function flaggedFiles(report: unknown, root: string): string[] {
  assert.ok(Array.isArray(report));
  return report.flatMap((result: unknown) => {
    assert.ok(typeof result === "object" && result !== null);
    assert.ok("filePath" in result && typeof result.filePath === "string");
    assert.ok("errorCount" in result && typeof result.errorCount === "number");
    return result.errorCount > 0 ? [path.relative(root, result.filePath)] : [];
  });
}

test("the repository lint reads catalogue sources and skips generated output", async (t) => {
  const fixture = await policyFixture();
  t.after(fixture.cleanup);
  for (const file of [".gitignore", "eslint.config.js", "package.json"])
    await fixture.write(
      file,
      await readFile(path.join(repository, file), "utf8"),
    );
  await symlink(
    path.join(repository, "node_modules"),
    path.join(fixture.root, "node_modules"),
    "dir",
  );
  for (const file of [...sources, ...output])
    await fixture.write(file, "const unused = 1;\n");
  const script = lintScript(
    JSON.parse(await readFile(path.join(fixture.root, "package.json"), "utf8")),
  );
  const lint = spawnSync(
    "sh",
    ["-c", script + " --format json --output-file lint.json"],
    { cwd: fixture.root, encoding: "utf8" },
  );
  assert.equal(lint.status, 1, lint.stderr);
  const report: unknown = JSON.parse(
    await readFile(path.join(fixture.root, "lint.json"), "utf8"),
  );
  assert.deepEqual(
    flaggedFiles(report, await realpath(fixture.root)).sort(),
    [...sources].sort(),
  );
});

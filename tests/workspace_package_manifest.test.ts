import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { packageRoot, repositoryRoot } from "./helpers/fixture.js";

test("the private workspace owns tooling while the CLI manifest owns the published interface", async () => {
  const [workspace, cli] = await Promise.all(
    [repositoryRoot, packageRoot].map(async (root) =>
      JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")),
    ),
  );
  assert.equal(workspace.name, "mokly-workspace");
  assert.equal(workspace.private, true);
  assert.equal(workspace.type, "module");
  assert.deepEqual(workspace.workspaces, ["packages/viewer", "packages/mokly"]);
  for (const key of [
    "bin",
    "exports",
    "files",
    "dependencies",
    "version",
    "peerDependencies",
    "types",
    "publishConfig",
  ])
    assert.equal(Object.hasOwn(workspace, key), false, key);
  assert.equal(cli.name, "@mokly/mokly");
  assert.notEqual(cli.private, true);
  assert.equal(cli.type, "module");
  assert.equal(cli.repository.directory, "packages/mokly");
  assert.deepEqual(cli.bin, { mokly: "./dist/cli/bin.js" });
  assert.equal(cli.engines.node, workspace.engines.node);
  assert.equal(Object.hasOwn(cli, "devDependencies"), false);
  for (const key of [
    "scripts",
    "devDependencies",
    "overrides",
    "packageManager",
  ])
    assert.ok(workspace[key], key);
});

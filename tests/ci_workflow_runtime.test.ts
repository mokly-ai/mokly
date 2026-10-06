import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  SUPPORTED_NODE_RANGE,
  TESTED_NODE_VERSIONS,
  isSupportedNodeVersion,
} from "../packages/mokly/dist/cli/bootstrap.js";
import { cliLockKey } from "../scripts/package/layout.mjs";

import { packageRoot, repositoryRoot } from "./helpers/fixture.js";

const testedNodeVersions: readonly string[] = TESTED_NODE_VERSIONS;
const [, currentTestedNode] = TESTED_NODE_VERSIONS;

test("local, package and CI runtimes share the Node compatibility policy", async () => {
  const [version, manifestSource, cliManifestSource, lockSource, readme] =
    await Promise.all([
      fs.readFile(path.join(repositoryRoot, ".node-version"), "utf8"),
      fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
      fs.readFile(path.join(packageRoot, "package.json"), "utf8"),
      fs.readFile(path.join(repositoryRoot, "package-lock.json"), "utf8"),
      fs.readFile(path.join(repositoryRoot, "README.md"), "utf8"),
    ]);
  const manifest = JSON.parse(manifestSource) as {
    engines: { node: string };
  };
  const cliManifest = JSON.parse(cliManifestSource) as {
    engines: { node: string };
  };
  const lock = JSON.parse(lockSource) as {
    packages: Record<string, { engines: { node: string } }>;
  };
  assert.equal(version.trim(), currentTestedNode);
  assert.equal(manifest.engines.node, SUPPORTED_NODE_RANGE);
  assert.equal(lock.packages[""]?.engines.node, manifest.engines.node);
  assert.equal(cliManifest.engines.node, manifest.engines.node);
  assert.equal(
    lock.packages[cliLockKey()]?.engines.node,
    cliManifest.engines.node,
  );
  assert.ok(
    readme.includes(`\`${SUPPORTED_NODE_RANGE}\``),
    "the README must document the supported Node range",
  );
  assert.ok(
    readme.includes("[`.node-version`](./.node-version)"),
    "development setup must follow the tested Node version",
  );
  assert.ok(TESTED_NODE_VERSIONS.every(isSupportedNodeVersion));
  assert.ok(testedNodeVersions.includes(version.trim()));
});

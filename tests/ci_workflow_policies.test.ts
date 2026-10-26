/**
 * The xtask repository rules check the workflow files. These cases run
 * Node-only code: the package's version check, the npm `semver` range check,
 * and the browser suite's command builder.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  assertNodeVersion,
  SUPPORTED_NODE_RANGE,
  TESTED_NODE_VERSIONS,
} from "../packages/mokly/src/version.mjs";

import { exampleServerCommand } from "./browser/example_servers.js";
import { EXAMPLE_BASE } from "./helpers/example_base.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("Node version files agree with the package engines and README", async () => {
  const [nvmrc, manifestSource, lockSource, readme] = await Promise.all([
    readText(".nvmrc"),
    readText("package.json"),
    readText("package-lock.json"),
    readText("README.md"),
  ]);
  const manifest = JSON.parse(manifestSource) as {
    engines: { node: string };
  };
  const lock = JSON.parse(lockSource) as {
    packages: { "": { engines: { node: string } } };
  };
  assert.equal(nvmrc.trim(), TESTED_NODE_VERSIONS.at(-1));
  assert.equal(manifest.engines.node, SUPPORTED_NODE_RANGE);
  const cli = JSON.parse(await readText("packages/mokly/package.json"));
  assert.equal(cli.engines.node, SUPPORTED_NODE_RANGE);
  for (const version of TESTED_NODE_VERSIONS) assertNodeVersion(version);
  const { satisfies } = await import("semver");
  assert.ok(
    satisfies(nvmrc.trim(), manifest.engines.node),
    ".nvmrc must select a supported Node version",
  );
  assert.equal(
    lock.packages[""].engines.node,
    manifest.engines.node,
    "the lockfile root engines must match package.json",
  );
  assert.ok(
    readme.includes(`\`${manifest.engines.node}\``),
    "the README must document the supported Node range",
  );
  assert.ok(
    readme.includes("[`.nvmrc`](./.nvmrc)"),
    "development setup must follow the tested Node version",
  );
});

test("shared example servers use the reserved unavailable base", () => {
  const args = exampleServerCommand();
  assert.equal(args[args.indexOf("--base") + 1], EXAMPLE_BASE);
  assert.equal(args[0], "packages/mokly/bin/mokly.mjs");
});

async function readText(file: string): Promise<string> {
  return await fs.readFile(path.join(repositoryRoot, file), "utf8");
}

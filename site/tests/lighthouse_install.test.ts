import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { repositoryPath, sitePath } from "../src/workspace.js";

test("Lighthouse stays outside the normal workspace install with exact independent pins", async () => {
  const root = JSON.parse(
    await readFile(repositoryPath("package.json"), "utf8"),
  ) as { workspaces: string[] };
  assert.deepEqual(
    root.workspaces.filter(
      (workspace) => workspace === "site" || workspace.startsWith("site/"),
    ),
    ["site"],
  );
  const lock = JSON.parse(
    await readFile(repositoryPath("package-lock.json"), "utf8"),
  ) as {
    packages: Record<
      string,
      { version?: string; devDependencies?: Record<string, string> }
    >;
  };
  assert.ok(
    Object.keys(lock.packages).every(
      (name) => !/(?:^|\/)node_modules\/lighthouse$/.test(name),
    ),
  );
  for (const name of ["lighthouse", "chrome-launcher"])
    assert.equal(lock.packages["site"]?.devDependencies?.[name], undefined);
  const tools = JSON.parse(
    await readFile(sitePath("lighthouse/package.json"), "utf8"),
  ) as {
    dependencies: Record<string, string>;
    engines: { node: string };
    private: boolean;
  };
  const toolsLock = JSON.parse(
    await readFile(sitePath("lighthouse/package-lock.json"), "utf8"),
  ) as { packages: Record<string, { version?: string }> };
  assert.equal(tools.private, true);
  assert.equal(tools.engines.node, ">=22.19.0");
  assert.deepEqual(Object.keys(tools.dependencies).sort(), [
    "chrome-launcher",
    "lighthouse",
  ]);
  for (const [name, version] of Object.entries(tools.dependencies)) {
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.equal(toolsLock.packages[`node_modules/${name}`]?.version, version);
  }
});

test("a local audit without the separate tools gives install guidance before starting a server", async (t) => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "mokly-lighthouse-install-"),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "scripts"));
  const script = path.join(root, "scripts/lighthouse.mjs");
  await copyFile(sitePath("scripts/lighthouse.mjs"), script);
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Node 22\.19\+/);
  assert.match(
    result.stderr,
    /npm ci --prefix site\/lighthouse --engine-strict/,
  );
  assert.match(result.stderr, /npm run site:lighthouse/);
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|EADDRINUSE/);
});

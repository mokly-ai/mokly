import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { releaseUpdates } from "../scripts/release/version_updates.mjs";
import { verifyPackageVersions } from "../scripts/release/versions.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const json = async (file: string) =>
  JSON.parse(await fs.readFile(path.join(repositoryRoot, file), "utf8"));

test("the private workspace coordinates a CLI and viewer release with seven public packages", async () => {
  await verifyPackageVersions(repositoryRoot);
  const [manifest, config, versions] = await Promise.all([
    json("package.json"),
    json("release-please-config.json"),
    json(".release-please-manifest.json"),
  ]);
  for (const key of ["bin", "exports", "files", "publishConfig", "types"])
    assert.equal(manifest[key], undefined, key);
  assert.deepEqual(Object.keys(config.packages).sort(), [
    "packages/mokly",
    "packages/viewer",
  ]);
  assert.deepEqual(
    Object.keys(versions).sort(),
    Object.keys(config.packages).sort(),
  );
  assert.deepEqual(config.plugins, [
    { type: "node-workspace", updateAllPackages: true },
  ]);
  for (const [key, component, prefix] of [
    ["packages/mokly", "mokly", false],
    ["packages/viewer", "viewer", true],
  ]) {
    const entry = config.packages[String(key)];
    assert.equal(entry.component, component);
    assert.equal(entry["release-type"], "node");
    assert.equal(entry["include-component-in-tag"], prefix);
    assert.equal(entry["include-v-in-tag"], true);
    assert.equal(entry["bump-minor-pre-major"], true);
  }
});

test("pinned Release Please updates all manifest and lockfile edges and retains changelog history", async (t) => {
  const sourceHistory = await fs.readFile(
    path.join(repositoryRoot, "CHANGELOG.md"),
    "utf8",
  );
  for (const changed of [
    ["packages/mokly/src/index.ts"],
    ["packages/viewer/src/index.ts"],
    ["packages/mokly/src/index.ts", "packages/viewer/src/index.ts"],
  ]) {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-release-versions-"),
    );
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const updates = await releaseUpdates(repositoryRoot, changed);
    assert.ok(updates.has("packages/mokly/package.json"));
    assert.ok(updates.has("packages/viewer/package.json"));
    assert.ok(
      updates
        .get("CHANGELOG.md")
        ?.includes(sourceHistory.slice(sourceHistory.indexOf("\n") + 1).trim()),
    );
    assert.ok(!updates.has("packages/mokly/CHANGELOG.md"));
    for (const [file, content] of updates) {
      const destination = path.join(root, file);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, content);
    }
    const { cli, viewer } = await verifyPackageVersions(root);
    assert.notEqual(
      cli.version,
      (await json("packages/mokly/package.json")).version,
    );
    assert.notEqual(
      viewer.version,
      (await json("packages/viewer/package.json")).version,
    );
    assert.match(cli.version, /^0\./);
    assert.match(viewer.version, /^0\./);
  }
});

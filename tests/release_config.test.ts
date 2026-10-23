import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { releasePackages } from "../scripts/release/targets.mjs";
import { releaseUpdates } from "../scripts/release/version_updates.mjs";
import { verifyPackageVersions } from "../scripts/release/versions.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const json = async (file: string) =>
  JSON.parse(await fs.readFile(path.join(repositoryRoot, file), "utf8"));

test("the private workspace releases the CLI and viewer with one root version", async () => {
  await verifyPackageVersions(repositoryRoot);
  const [manifest, config, versions] = await Promise.all([
    json("package.json"),
    json("release-please-config.json"),
    json(".release-please-manifest.json"),
  ]);
  for (const key of ["bin", "exports", "files", "publishConfig", "types"])
    assert.equal(manifest[key], undefined, key);
  assert.deepEqual(Object.keys(config.packages), ["."]);
  assert.deepEqual(Object.keys(versions).sort(), [".", "packages/viewer"]);
  assert.equal(config.plugins, undefined);
  const entry = config.packages["."];
  assert.equal(entry.component, "mokly");
  assert.equal(entry["release-type"], "node");
  assert.equal(entry["include-component-in-tag"], false);
  assert.equal(entry["include-v-in-tag"], true);
  assert.equal(entry["bump-minor-pre-major"], true);
  assert.ok(
    Array.isArray(entry["extra-files"]) &&
      entry["extra-files"].some(
        (file: unknown) =>
          typeof file === "object" &&
          file !== null &&
          "path" in file &&
          file.path === "/packages/viewer/package.json",
      ),
  );
});

test("pinned Release Please updates all manifest and lockfile edges and retains changelog history", async (t) => {
  const sourceHistory = await fs.readFile(
    path.join(repositoryRoot, "CHANGELOG.md"),
    "utf8",
  );
  for (const changed of [
    ["crates/mokly-css/src/compiler.rs"],
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
    assert.match(
      updates.get("packages/viewer/CHANGELOG.md") ?? "",
      /Shared release version: 0\.16\.0/,
    );
    for (const file of [
      "package.json",
      "package-lock.json",
      ".release-please-manifest.json",
      ...releasePackages().map(({ directory }) => `${directory}/package.json`),
    ]) {
      const destination = path.join(root, file);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(repositoryRoot, file), destination);
    }
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
    assert.equal(viewer.version, cli.version);
    assert.match(cli.version, /^0\./);
    assert.match(viewer.version, /^0\./);
  }
});

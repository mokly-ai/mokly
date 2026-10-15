import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

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

test("release JSON updates move manifests and lockfile together without changing private native links", async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-release-versions-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = await json("release-please-config.json");
  const contents = new Map<string, Record<string, unknown>>();
  const versions = { "packages/mokly": "0.15.0", "packages/viewer": "0.6.0" };
  for (const [component, version] of Object.entries(versions)) {
    for (const update of [
      {
        path: `/${component}/package.json`,
        jsonpath: "$['version']",
        type: "json",
      },
      ...config.packages[component]["extra-files"],
    ]) {
      if (update.type !== "json") continue;
      const file = update.path.slice(1);
      const content = contents.get(file) ?? (await json(file));
      setVersion(content, update.jsonpath, version);
      contents.set(file, content);
    }
  }
  contents.set(".release-please-manifest.json", versions);
  for (const [file, content] of contents) {
    const destination = path.join(root, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, JSON.stringify(content));
  }
  await verifyPackageVersions(root);
});

// Apply the JSONPath subset used by the release configuration. A separate
// recorded integration run exercises the real pinned Release Please plugin.
function setVersion(
  root: Record<string, unknown>,
  selector: string,
  version: string,
) {
  const keys = [...selector.matchAll(/\['([^']*)'\]|\[\*\]/gu)].map(
    (match) => match[1] ?? "*",
  );
  assert.equal(
    "$" + keys.map((key) => (key === "*" ? "[*]" : `['${key}']`)).join(""),
    selector,
  );
  let owner = root;
  for (const key of keys.slice(0, -1))
    owner = owner[key] as Record<string, unknown>;
  const last = keys.at(-1)!;
  if (last === "*") for (const key of Object.keys(owner)) owner[key] = version;
  else owner[last] = version;
}

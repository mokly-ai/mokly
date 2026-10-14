import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
async function json(file: string) {
  return JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
}

test("the workspace is private and only the viewer has a release path", async () => {
  const [manifest, lock, config, versions, viewer] = await Promise.all([
    json("package.json"),
    json("package-lock.json"),
    json("release-please-config.json"),
    json(".release-please-manifest.json"),
    json("packages/viewer/package.json"),
  ]);
  assert.equal(manifest.private, true);
  for (const key of ["bin", "exports", "files", "publishConfig", "types"])
    assert.equal(manifest[key], undefined, key);
  assert.equal(lock.packages[""].bin, undefined);
  assert.deepEqual(Object.keys(config.packages), ["packages/viewer"]);
  assert.deepEqual(Object.keys(versions), ["packages/viewer"]);
  assert.equal(versions["packages/viewer"], viewer.version);
  assert.equal(config.packages["packages/viewer"].component, "viewer");
  assert.equal(config.packages["packages/viewer"]["release-type"], "node");
  assert.equal(viewer.publishConfig.access, "public");
  assert.equal(manifest.devDependencies["@mokly/viewer"], viewer.version);
});

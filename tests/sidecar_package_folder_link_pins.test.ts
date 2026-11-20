import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { write } from "./helpers/native_resolution.js";
import { folderPackage } from "./helpers/package_folder.js";

test("marked folder reuse rejects replacement of a dangling preferred link", async (context) => {
  const fixture = await folderPackage(context, {
    name: "replaced dangling preferred link",
    brokenCandidate: true,
  });
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.match(first.result.compiled.code, /original-index/);
  await fixture.unrelated();
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    first.result.compiled.runtimeKey,
    "unrelated additions retain marked reuse while the link stays dangling",
  );
  const absentTarget = await fs.readlink(fixture.preferred);
  await fs.unlink(fixture.preferred);
  await write(fixture.preferred, 'export const value="preferred-file";');
  await assert.rejects(fs.lstat(absentTarget), { code: "ENOENT" });
  const native = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(native.result.compiled.code, /preferred-file/);
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    undefined,
    "replacing a dangling preferred link with a regular file must reject the retained marked key",
  );
});

test("marked folder reuse rejects a skipped folder link retargeted to a file", async (context) => {
  const fixture = await folderPackage(context, {
    name: "retargeted preferred folder link",
  });
  const folder = path.join(fixture.root, "targets/folder");
  const file = path.join(fixture.root, "targets/preferred.ts");
  await fs.mkdir(folder, { recursive: true });
  await write(file, 'export const value="preferred-file";');
  await fs.symlink(folder, fixture.preferred, "dir");
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.match(first.result.compiled.code, /original-index/);
  await fixture.unrelated();
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    first.result.compiled.runtimeKey,
    "unrelated additions retain marked reuse while the link targets a folder",
  );
  await fs.unlink(fixture.preferred);
  await fs.symlink(file, fixture.preferred, "file");
  const native = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(native.result.compiled.code, /preferred-file/);
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    undefined,
    "retargeting a skipped folder link to a file must reject the retained marked key",
  );
});

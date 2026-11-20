import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { write } from "./helpers/native_resolution.js";
import { folderPackage } from "./helpers/package_folder.js";
import { linkedFolder } from "./helpers/package_folder_links.js";
import { pnpFolder } from "./helpers/pnp_folder.js";

for (const kind of ["manifest", "selected", "both"] as const)
  test(`marked folder candidates survive ${kind} file links while exact selections keep reuse`, async (context) => {
    for (const internal of [false, true])
      for (const folder of [true, false]) {
        const fixture = await linkedFolder(context, kind, folder, internal);
        const first = await bundle(
          fixture.params,
          build,
          undefined,
          undefined,
          "serveEdit",
        );
        assert.equal(
          first.result.compiled.reuseEvidence.uncaptured,
          "serveEdit",
        );
        assert.match(first.result.compiled.code, /original-index/);
        await fixture.unrelated();
        assert.equal(
          (await reuse([first.generation], fixture.params, "serveEdit"))
            ?.runtimeKey,
          first.result.compiled.runtimeKey,
        );
        await fixture.addPreferred();
        const fresh = await bundle(
          fixture.params,
          build,
          undefined,
          undefined,
          "serveEdit",
        );
        assert.match(
          fresh.result.compiled.code,
          folder ? /preferred-file/ : /original-index/,
        );
        assert.equal(
          (await reuse([first.generation], fixture.params, "serveEdit"))
            ?.runtimeKey,
          folder ? undefined : first.result.compiled.runtimeKey,
          `${kind} internal=${internal} folder=${folder}`,
        );
      }
  });

test("full PnP folder capture compares a linked manifest by its physical identity", async (context) => {
  const fixture = await pnpFolder(context, "json");
  const file = path.join(fixture.root, ".yarn/chosen/package.json");
  const target = path.join(fixture.root, "metadata/chosen/package.json");
  await write(target, await fs.readFile(file, "utf8"));
  await fs.unlink(file);
  await fs.symlink(target, file, "file");
  const first = await bundle(fixture.params, build);
  assert.match(first.result.compiled.code, /original-index/);
  assert.equal(first.result.compiled.reuseEvidence.complete, true);
  await fixture.unrelated();
  assert.equal(
    (await reuse([first.generation], fixture.params))?.runtimeKey,
    first.result.compiled.runtimeKey,
  );
  await fixture.addPreferred();
  const fresh = await bundle(fixture.params, build);
  assert.match(fresh.result.compiled.code, /preferred-file/);
  assert.equal(
    (await reuse([first.generation], fixture.params))?.runtimeKey,
    undefined,
  );
});

test("a non-bare builtin alias retains its effective package folder checks", async (context) => {
  const fixture = await folderPackage(context, {
    name: "builtin alias",
    route: "installed",
    request: "node:fs",
  });
  fixture.params.moduleResolution.aliases = { "node:fs": "chosen/sub/value" };
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(first.result.compiled.code, /original-index/);
  await fixture.unrelated();
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    first.result.compiled.runtimeKey,
  );
  await fixture.addPreferred();
  const fresh = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(fresh.result.compiled.code, /preferred-file/);
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    undefined,
  );
});

test("an internal folder remap places a linked index in a legacy package", async (context) => {
  const fixture = await folderPackage(context, {
    name: "linked legacy remap",
    route: "installed",
    request: "#sub/value",
    manifest: '{"name":"chosen"}',
    original: "sub/value/index.js",
    preferred: "sub/value.ts",
  });
  await write(
    path.join(fixture.root, "package.json"),
    '{"name":"catalogue","imports":{"#sub/":"chosen/sub/"}}',
  );
  const target = path.join(fixture.root, "shared/index.js");
  await write(target, await fs.readFile(fixture.original, "utf8"));
  await fs.unlink(fixture.original);
  await fs.symlink(target, fixture.original, "file");
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(first.result.compiled.code, /original-index/);
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  await fixture.unrelated();
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    first.result.compiled.runtimeKey,
  );
  await fixture.addPreferred();
  const fresh = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(fresh.result.compiled.code, /preferred-file/);
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    undefined,
  );
});

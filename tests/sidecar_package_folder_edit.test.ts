import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { write } from "./helpers/native_resolution.js";
import { folderPackage } from "./helpers/package_folder.js";
import type { FolderCase } from "./helpers/package_folder.js";

const cases: FolderCase[] = [
  {
    name: "self-package folder",
    manifest: '{"name":"chosen","exports":{"./sub/":"./sub/"}}',
    original: "sub/value/index.js",
    preferred: "sub/value.ts",
  },
  { name: "non-identity installed folder", route: "installed" },
  { name: "linked package folder", route: "linked" },
  {
    name: "internal relative folder target",
    manifest: '{"name":"chosen","imports":{"#sub/":"./lib/"}}',
    request: "#sub/value",
  },
  {
    name: "internal bare package folder remap",
    manifest: '{"name":"chosen","imports":{"#sub/":"other/sub/"}}',
    request: "#sub/value",
    original: "node_modules/other/lib/value/index.js",
    preferred: "node_modules/other/lib/value.ts",
  },
  {
    name: "internal bare remap to a package without a manifest",
    manifest: '{"name":"chosen","imports":{"#sub/":"other/sub/"}}',
    request: "#sub/value",
    original: "node_modules/other/sub/value/index.js",
    preferred: "node_modules/other/sub/value.ts",
  },
  {
    name: "nested main candidate of a mapped folder",
    original: "lib/value/nested/choice/index.js",
    preferred: "lib/value/nested/choice.ts",
    nestedManifest: '{"main":"./nested/choice"}',
  },
  {
    name: "earlier main field of a mapped folder",
    original: "lib/value/two/value.js",
    preferred: "lib/value/one/value.js",
    extra: ["lib/value/one/.keep"],
    nestedManifest: '{"module":"./one/value.js","main":"./two/value.js"}',
    mainFields: ["module", "main"],
  },
  {
    name: "main field before a mapped folder index",
    nestedManifest: '{"main":"./dist/index.js"}',
    preferred: "lib/value/dist/index.js",
  },
];

for (const row of cases)
  test(`marked package-folder reuse rejects ${row.name} after a candidate appears`, async (context) => {
    const fixture = await folderPackage(context, row);
    if (row.name === "internal bare package folder remap")
      await write(
        path.join(fixture.root, "node_modules/other/package.json"),
        '{"name":"other","exports":{"./sub/":"./lib/"}}',
      );
    const { params } = fixture;
    const first = await bundle(
      params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
    assert.match(first.result.compiled.code, /original-index/);
    await fixture.unrelated();
    assert.equal(
      (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
      first.result.compiled.runtimeKey,
      "unrelated additions retain marked reuse",
    );
    await fixture.addPreferred();
    const native = await bundle(
      params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.match(native.result.compiled.code, /preferred-file/);
    assert.equal(
      (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
      undefined,
    );
  });

test("a known folder mapping with an unplaceable target withholds the marker", async (context) => {
  const { params } = await folderPackage(context, {
    name: "unplaceable inactive folder target",
    manifest:
      '{"name":"chosen","exports":{"./sub/":{"node":"./lib/","default":"./%2e%2e/escaped/"}}}',
  });
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.match(first.result.compiled.code, /original-index/);
  assert.deepEqual(first.result.compiled.reuseEvidence, {
    complete: false,
    durable: false,
    inputs: {},
  });
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
  );
});

test("marked discovery keeps ordinary reuse below the metadata cap and withholds it above the cap", async (context) => {
  for (const row of [
    { bytes: 1_048_000, marker: "serveEdit", reused: true },
    { bytes: 1_048_576, marker: undefined, reused: false },
  ]) {
    const fixture = await folderPackage(context, {
      name: `ordinary manifest padding ${row.bytes}`,
      manifest: JSON.stringify({
        name: "chosen",
        exports: { "./sub/value": "./lib/value.js" },
        padding: "x".repeat(row.bytes),
      }),
      original: "lib/value.js",
    });
    const first = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.match(first.result.compiled.code, /original-index/);
    assert.equal(
      first.result.compiled.reuseEvidence.uncaptured,
      row.marker,
      String(row.bytes),
    );
    await fixture.unrelated();
    assert.equal(
      (await reuse([first.generation], fixture.params, "serveEdit"))
        ?.runtimeKey,
      row.reused ? first.result.compiled.runtimeKey : undefined,
      String(row.bytes),
    );
  }
});

for (const preferred of ["lib/value.ts", "lib/value/index.ts"])
  test(`marked folder reuse rejects the target appearance of broken ${preferred}`, async (context) => {
    const fixture = await folderPackage(context, {
      name: preferred,
      preferred,
      brokenCandidate: true,
    });
    const full = await bundle(fixture.params, build);
    assert.equal(
      full.result.compiled.reuseEvidence.complete,
      false,
      "rich directory evidence already fails closed on a broken link",
    );
    const first = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
    await fixture.unrelated();
    assert.equal(
      (await reuse([first.generation], fixture.params, "serveEdit"))
        ?.runtimeKey,
      first.result.compiled.runtimeKey,
    );
    await fixture.addPreferred();
    const native = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.match(native.result.compiled.code, /preferred-file/);
    assert.equal(
      (await reuse([first.generation], fixture.params, "serveEdit"))
        ?.runtimeKey,
      undefined,
    );
  });

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { write } from "./helpers/native_resolution.js";
import { folderPackage } from "./helpers/package_folder.js";

test("an exact export keeps full and marked reuse when a shadowed folder candidate appears", async (context) => {
  for (const capture of ["full", "serveEdit"] as const) {
    const fixture = await folderPackage(context, {
      name: "exact types export",
      manifest:
        '{"name":"chosen","exports":{"./":"./mapped/","./types":"./types.js"}}',
      request: "chosen/types",
      original: "types.js",
      preferred: "mapped/types.ts",
      extra: ["mapped/types/index.js"],
    });
    const first = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      capture,
    );
    assert.match(first.result.compiled.code, /original-index/);
    await fixture.addPreferred();
    const native = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      capture,
    );
    assert.match(native.result.compiled.code, /original-index/);
    assert.equal(
      (await reuse([first.generation], fixture.params, capture))?.runtimeKey,
      first.result.compiled.runtimeKey,
      capture,
    );
  }
});

test("an inactive unsupported non-folder target keeps ordinary marked reuse", async (context) => {
  const fixture = await folderPackage(context, {
    name: "inactive target",
    manifest:
      '{"name":"chosen","exports":{"./sub/value":{"browser":false,"node":"./lib/value.js"}}}',
    original: "lib/value.js",
  });
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  const inputs = Object.entries(first.result.compiled.reuseEvidence.inputs);
  assert.deepEqual(
    Object.fromEntries(
      inputs.map(([file, input]) => [
        path.relative(fixture.root, file).split(path.sep).join("/"),
        input.kind,
      ]),
    ),
    {
      "lib/package.json": "absent",
      "package.json": "file",
      "src/value.js": "absent",
      "src/value.jsx": "absent",
      "src/value.ts": "absent",
      "src/value.tsx": "absent",
      "tsconfig.json": "absent",
    },
  );
  await fixture.unrelated();
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    first.result.compiled.runtimeKey,
  );
  await write(
    path.join(fixture.root, "src/value.ts"),
    'export const value="workspace-source";',
  );
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    undefined,
  );
});

test("non-object package metadata keeps ordinary marked reuse and full refusal", async (context) => {
  for (const manifest of ["null", "[]", "42"]) {
    const fixture = await folderPackage(context, {
      name: manifest,
      route: "installed",
      manifest: '{"name":"chosen","exports":{"./sub/value":"./lib/value.js"}}',
      original: "lib/value.js",
    });
    await write(path.join(fixture.root, "package.json"), manifest);
    const full = await bundle(fixture.params, build);
    assert.match(full.result.compiled.code, /original-index/);
    assert.equal(full.result.compiled.reuseEvidence.complete, false);
    const marked = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.equal(
      marked.result.compiled.reuseEvidence.uncaptured,
      "serveEdit",
      manifest,
    );
    assert.deepEqual(marked.result.compiled.reuseEvidence.inputs, {});
    await fixture.unrelated();
    assert.equal(
      (await reuse([marked.generation], fixture.params, "serveEdit"))
        ?.runtimeKey,
      marked.result.compiled.runtimeKey,
    );
  }
});

test("an unselected invalid package manifest keeps ordinary marked reuse and full refusal", async (context) => {
  const fixture = await folderPackage(context, {
    name: "invalid higher package copy",
    route: "installed",
    manifest: '{"name":"chosen"}',
    original: "sub/value.js",
  });
  await write(
    path.join(path.dirname(fixture.root), "node_modules/chosen/package.json"),
    '{"exports":',
  );
  const full = await bundle(fixture.params, build);
  assert.match(full.result.compiled.code, /original-index/);
  assert.equal(full.result.compiled.reuseEvidence.complete, false);
  const marked = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(marked.result.compiled.code, /original-index/);
  assert.equal(marked.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.deepEqual(marked.result.compiled.reuseEvidence.inputs, {});
  await fixture.unrelated();
  assert.equal(
    (await reuse([marked.generation], fixture.params, "serveEdit"))?.runtimeKey,
    marked.result.compiled.runtimeKey,
  );
});

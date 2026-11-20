import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { write } from "./helpers/native_resolution.js";
import { folderPackage } from "./helpers/package_folder.js";

function conditions(value: string, count: number): unknown {
  let target: unknown = value;
  for (let index = 0; index < count; index++) target = { node: target };
  return target;
}

test("an unfinished deep internal remap withholds reuse before a folder candidate appears", async (context) => {
  const fixture = await folderPackage(context, {
    name: "forty active conditions",
    route: "installed",
    request: "#value",
  });
  await write(
    path.join(fixture.root, "package.json"),
    JSON.stringify({
      name: "catalogue",
      imports: { "#value": conditions("chosen/sub/value", 40) },
    }),
  );
  const full = await bundle(fixture.params, build);
  assert.match(full.result.compiled.code, /original-index/);
  assert.equal(full.result.compiled.reuseEvidence.complete, false);
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(first.result.compiled.code, /original-index/);
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, undefined);
  assert.equal(
    await reuse([first.generation], fixture.params, "serveEdit"),
    undefined,
  );
  await fixture.addPreferred();
  assert.equal(
    await reuse([first.generation], fixture.params, "serveEdit"),
    undefined,
  );
  const fresh = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(fresh.result.compiled.code, /preferred-file/);
});

test("a below-limit ordinary internal-import chain keeps its marker and reuse", async (context) => {
  const fixture = await folderPackage(context, {
    name: "ordinary active conditions",
    route: "installed",
    request: "#value",
  });
  await write(
    path.join(fixture.root, "package.json"),
    JSON.stringify({
      name: "catalogue",
      imports: { "#value": conditions("./ordinary.mjs", 8) },
    }),
  );
  await write(
    path.join(fixture.root, "ordinary.mjs"),
    'export const value="ordinary-file";',
  );
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(first.result.compiled.code, /ordinary-file/);
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    first.result.compiled.runtimeKey,
  );
});

test("an unfinished forced exports walk withholds the imports marker", async (context) => {
  const fixture = await folderPackage(context, {
    name: "forced exports conditions",
    route: "installed",
    request: "#sub/value",
    manifest: JSON.stringify({
      name: "chosen",
      exports: {
        "./sub/value": {
          node: "./lib/value/index.js",
          default: conditions("./other/value", 40),
        },
      },
    }),
  });
  await write(
    path.join(fixture.root, "package.json"),
    '{"name":"catalogue","imports":{"#sub/":"chosen/sub/"}}',
  );
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(first.result.compiled.code, /original-index/);
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, undefined);
  assert.equal(
    await reuse([first.generation], fixture.params, "serveEdit"),
    undefined,
  );
});

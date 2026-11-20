import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { write } from "./helpers/native_resolution.js";
import { pnpFolder } from "./helpers/pnp_folder.js";

test("marked internal folder remaps cover a native PnP legacy package root", async (context) => {
  const fixture = await pnpFolder(context, "json");
  await write(
    path.join(fixture.root, "package.json"),
    '{"name":"catalogue","imports":{"#sub/":"chosen/sub/"}}',
  );
  await write(
    path.join(fixture.root, "entry.mjs"),
    'export {value} from "#sub/value";',
  );
  await write(
    path.join(fixture.root, ".yarn/chosen/package.json"),
    '{"name":"chosen"}',
  );
  await write(
    path.join(fixture.root, ".yarn/chosen/sub/value/index.js"),
    'export const value="original-index";',
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
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    first.result.compiled.runtimeKey,
  );
  await write(
    path.join(fixture.root, ".yarn/chosen/sub/value.ts"),
    'export const value="preferred-file";',
  );
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
  );
});

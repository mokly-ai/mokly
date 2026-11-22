import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { folderPackage } from "./helpers/package_folder.js";

test("a post-build preferred file must not certify the old native index", async (context) => {
  const fixture = await folderPackage(context, {
    name: "post-build installed folder candidate",
    route: "installed",
  });
  let compilations = 0;
  const compile: typeof build = async (options) => {
    compilations++;
    const result = await build(options);
    await fixture.addPreferred();
    return result;
  };
  const first = await bundle(
    fixture.params,
    compile,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.equal(compilations, 1);
  assert.match(first.result.compiled.code, /original-index/);
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
    "a post-build preferred file must not certify the old native index",
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, undefined);
});

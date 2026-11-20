import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { checkRecipeSize } from "../packages/mokly/src/sidecar/recipe-size.js";

import { folderPackage } from "./helpers/package_folder.js";

test("dropping an oversized folder file table removes marked eligibility", async (context) => {
  const fixture = await folderPackage(context, { name: "dropped table" });
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.ok(Object.keys(first.result.compiled.reuseEvidence.inputs).length > 0);
  first.result.compiled.reuseEvidence.inputs["x".repeat(4096)] = {
    kind: "absent",
  };
  const bytes = Buffer.byteLength(JSON.stringify(first.result));
  checkRecipeSize(fixture.params, first.result, bytes);
  assert.deepEqual(first.result.compiled.reuseEvidence, {
    complete: false,
    durable: false,
    inputs: {},
  });
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    undefined,
  );
});

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import {
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";

test("a bundled built-in skipped by Node's list cannot produce reusable evidence", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "entry.mjs"),
    'export {value} from "readline/promises";',
  );
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"paths":{"readline/promises":["./values/chosen"]}}}',
  );
  await write(
    path.join(root, "values/chosen/index.js"),
    'export const value="mapped";',
  );
  const params = nativeParams(root);
  const captured = await bundle(params, build);
  assert.deepEqual(
    captured.result.modules.map((module) => module.path),
    ["entry.mjs", "values/chosen/index.js"],
  );
  assert.equal(captured.result.compiled.reuseEvidence.complete, false);
  assert.equal(await reuse([captured.generation], params), undefined);
  const next = await bundle(params, build);
  assert.notEqual(next.result.generation, captured.result.generation);
});

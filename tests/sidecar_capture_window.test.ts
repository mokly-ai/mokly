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

test("a higher candidate added between compile attempts makes evidence incomplete", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true } }),
  );
  await write(path.join(root, "entry.mjs"), 'export { value } from "./value";');
  await write(path.join(root, "value.js"), 'export const value = "original";');
  const params = nativeParams(root);
  let attempts = 0;
  const compile: typeof build = async (options) => {
    attempts++;
    const result = await build(options);
    if (attempts === 1)
      await write(
        path.join(root, "value.ts"),
        'export const value = "higher";',
      );
    return result;
  };
  const captured = await bundle(params, compile);
  assert.equal(attempts, 2);
  assert.equal(captured.result.compiled.reuseEvidence.complete, false);
  assert.deepEqual(
    captured.result.modules.map((module) => module.path),
    ["entry.mjs", "value.js"],
  );
  assert.match(captured.result.compiled.code, /original/);
  assert.equal(await reuse([captured.generation], params), undefined);
});

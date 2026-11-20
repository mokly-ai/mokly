import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import {
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

test("marked edits reject an index added to an earlier overlapping paths target", async (context) => {
  const root = await nativeRoot(context);
  const params = nativeParams(root);
  await write(path.join(root, "package.json"), "{}");
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"paths":{"fixture":["./mapped","./mapped/two/value.js"]}}}',
  );
  await write(path.join(root, "entry.mjs"), "export {value} from 'fixture';");
  await write(
    path.join(root, "mapped/two/value.js"),
    "export const value='two';",
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await write(path.join(root, "mapped/index.js"), "export const value='one';");
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
    "an added index in an earlier overlapping target must reject marked reuse",
  );
});

test("a mapped package folder with a nested main keeps marked edit reuse", async (context) => {
  const root = await nativeRoot(context);
  const params = nativeParams(root);
  await write(path.join(root, "package.json"), "{}");
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"paths":{"fixture":["./mapped"]}}}',
  );
  await write(path.join(root, "entry.mjs"), "export {value} from 'fixture';");
  await packageAt(
    path.join(root, "mapped"),
    "fixture",
    "export const value='package';",
    "./src/index.js",
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(
    evaluate(first.generation).entries["entry.mjs"]!.value,
    "package",
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
});

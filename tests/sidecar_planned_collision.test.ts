import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { PlanBuilder } from "../packages/mokly/src/sidecar/resolution-plan.js";

import {
  countedCompile,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

test("a relative string shared by safe and commonjs targets keeps every planned callback", async (context) => {
  const root = await nativeRoot(context);
  const clean = path.join(root, "node_modules/clean");
  const typed = path.join(root, "node_modules/typed");
  await packageAt(clean, "clean", 'export { value } from "./part.js";');
  await packageAt(typed, "typed", 'export { other } from "./part.js";');
  await write(path.join(clean, "part.js"), "export const value = 1;");
  await write(path.join(typed, "part.js"), "exports.other = 2;");
  await write(
    path.join(typed, "package.json"),
    '{"name":"typed","main":"index.mjs","type":"commonjs"}',
  );
  await write(
    path.join(root, "entry.mjs"),
    'export { value } from "clean"; export { other } from "typed";',
  );
  const counted = countedCompile();
  const plan = new PlanBuilder();
  for (const directory of [clean, typed])
    plan.addImport(
      path.join(directory, "index.mjs"),
      "./part.js",
      "import-statement",
      path.join(directory, "part.js"),
      true,
    );
  await bundle(
    nativeParams(root),
    counted.compile,
    undefined,
    undefined,
    "serveEdit",
    plan.plan,
  );
  assert.equal(counted.consumerCallbacks("./part.js"), 2);
  assert.equal(counted.counts.compilations, 1);
});

test("a saved side-effect flag keeps the callback when the current manifest would retain an unused import", async (context) => {
  const root = await nativeRoot(context);
  const entry = path.join(root, "entry.mjs");
  const target = path.join(root, "effect.mjs");
  await write(entry, 'import "./effect.mjs"; export const value = 1;');
  await write(target, "globalThis.effectRan = true;");
  const counted = countedCompile();
  const { result } = await bundle(
    nativeParams(root),
    counted.compile,
    undefined,
    undefined,
    "serveEdit",
    {
      paths: [entry, target],
      imports: [[0, "./effect.mjs", "import-statement", 1, false]],
    },
  );
  assert.doesNotMatch(result.compiled.code, /effectRan/);
  assert.equal(counted.consumerCallbacks("./effect.mjs"), 1);
  assert.equal(counted.counts.compilations, 1);
});

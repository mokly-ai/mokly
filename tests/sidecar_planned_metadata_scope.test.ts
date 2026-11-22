import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { ResolutionPlan } from "../packages/mokly/src/generated/sidecar/ResolutionPlan.js";
import { bundle, bundleWith } from "../packages/mokly/src/sidecar/bundle.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";
import { PlanLookup } from "../packages/mokly/src/sidecar/resolution-plan.js";

import { matureMetadata } from "./helpers/mature_metadata.js";
import {
  countedCompile,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

function value(result: BundleResult): unknown {
  const module = { exports: {} };
  const execute = new Function(
    "module",
    "exports",
    result.compiled.code +
      '\nreturn module.exports.entries["entry.mjs"].value;',
  );
  const resultValue: unknown = execute(module, module.exports);
  return resultValue;
}

function code(result: BundleResult): string {
  return result.compiled.code.replaceAll(
    result.compiled.runtimeKey,
    "mokly:runtime",
  );
}

test("a restored parsing scope first read after compilation rejects native output", async (context) => {
  const root = await nativeRoot(context);
  const known = await packageAt(
    path.join(root, "node_modules/known"),
    "known",
    'export { known } from "./impl.js";',
  );
  await write(path.join(known, "impl.js"), "export const known = 1;");
  const added = await packageAt(
    path.join(root, "node_modules/added"),
    "added",
    'export { value } from "./impl.js";',
  );
  await write(
    path.join(added, "impl.js"),
    'import value from "./cjs.cjs"; export { value };',
  );
  await write(
    path.join(added, "cjs.cjs"),
    'exports.__esModule = true; exports.default = "cjs-default";',
  );
  await write(
    path.join(root, "entry.mjs"),
    'export { known } from "known"; export { value } from "added";',
  );
  const manifest = path.join(added, "package.json");
  const original = await fs.readFile(manifest, "utf8");
  matureMetadata(context, new Set([manifest]));
  const params = nativeParams(root);
  const plan: ResolutionPlan = {
    paths: [path.join(known, "index.mjs"), path.join(known, "impl.js")],
    imports: [[0, "./impl.js", "import-statement", 1, true]],
  };
  let compiles = 0;
  const compile: typeof build = async (options) => {
    compiles++;
    if (compiles !== 1) return build(options);
    await fs.writeFile(
      manifest,
      '{"name":"added","main":"index.mjs","type":"module"}',
    );
    const result = await build(options);
    await fs.writeFile(manifest, original);
    await fs.utimes(
      manifest,
      new Date("2002-01-01T00:00:00.000Z"),
      new Date("2002-01-01T00:00:00.000Z"),
    );
    return result;
  };
  const guarded = await bundle(
    params,
    compile,
    unmeasured,
    undefined,
    "serveEdit",
    plan,
  );
  const complete = await bundleWith(params, build, unmeasured, {
    mode: "planned",
    plan: new PlanLookup(plan),
  });
  assert.equal(value(complete.result), "cjs-default");
  assert.equal(value(guarded.result), "cjs-default");
  assert.equal(compiles, 2);
  assert.equal(code(guarded.result), code(complete.result));
});

test("an unused prepared target does not add its young metadata to the native proof", async (context) => {
  const root = await nativeRoot(context);
  const known = await packageAt(
    path.join(root, "node_modules/known"),
    "known",
    'export { value } from "./impl.js";',
  );
  await write(path.join(known, "impl.js"), 'export const value = "known";');
  const unused = await packageAt(
    path.join(root, "node_modules/unused"),
    "unused",
    'export { value } from "./never.js";',
  );
  await write(path.join(unused, "never.js"), 'export const value = "unused";');
  await write(path.join(root, "entry.mjs"), 'export { value } from "known";');
  matureMetadata(
    context,
    new Set(),
    new Set([path.join(unused, "package.json")]),
  );
  const params = nativeParams(root);
  const plan: ResolutionPlan = {
    paths: [
      path.join(known, "index.mjs"),
      path.join(known, "impl.js"),
      path.join(unused, "index.mjs"),
      path.join(unused, "never.js"),
    ],
    imports: [
      [0, "./impl.js", "import-statement", 1, true],
      [2, "./never.js", "import-statement", 3, true],
    ],
  };
  const counted = countedCompile();
  const guarded = await bundle(
    params,
    counted.compile,
    unmeasured,
    undefined,
    "serveEdit",
    plan,
  );
  const complete = await bundleWith(params, build, unmeasured, {
    mode: "planned",
    plan: new PlanLookup(plan),
  });
  assert.equal(value(guarded.result), "known");
  assert.equal(code(guarded.result), code(complete.result));
  assert.equal(counted.counts.compilations, 1);
  assert.equal(counted.consumerCallbacks("./impl.js"), 0);
});

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundleWith } from "../packages/mokly/src/sidecar/bundle.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";
import { PlanLookup } from "../packages/mokly/src/sidecar/resolution-plan.js";

import {
  countedCompile,
  fingerprint,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

test("full-capture planned compilation keeps the complete path's evidence and watch inputs", async (context) => {
  const root = await nativeRoot(context);
  const head = path.join(root, "head");
  const base = path.join(root, "base");
  const library = path.join(head, "node_modules/lib");
  const target = path.join(base, "node_modules/lib/value.mjs");
  await packageAt(library, "lib", 'export { value } from "./value.mjs";');
  await write(
    path.join(library, "value.mjs"),
    'export { value } from "./speculative.mjs";',
  );
  await write(
    path.join(library, "speculative.mjs"),
    'export const value = "speculative";',
  );
  await write(target, 'export const value = "base";');
  await write(path.join(base, "entry.mjs"), 'export { value } from "lib";');
  const params = nativeParams(
    base,
    { repositoryRoots: [head] },
    { dependencyRoot: head, packageRoots: [head] },
  );
  const counted = countedCompile();
  const planned = await bundleWith(params, counted.compile, unmeasured, {
    mode: "planned",
    plan: new PlanLookup({
      paths: [path.join(library, "index.mjs"), target],
      imports: [[0, "./value.mjs", "import-statement", 1, true]],
    }),
  });
  const full = await bundleWith(params, build, unmeasured, { mode: "full" });
  assert.deepEqual(
    planned.result.compiled.reuseEvidence,
    full.result.compiled.reuseEvidence,
  );
  assert.deepEqual(fingerprint(planned.result), fingerprint(full.result));
  assert.equal(counted.counts.compilations, 1);
});

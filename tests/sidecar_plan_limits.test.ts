import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { CompiledGeneration } from "../packages/mokly/src/generated/sidecar/CompiledGeneration.js";
import type { ResolutionPlan } from "../packages/mokly/src/generated/sidecar/ResolutionPlan.js";
import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { capturedPlan } from "../packages/mokly/src/sidecar/captured-plan.js";
import { checkRecipeSize } from "../packages/mokly/src/sidecar/recipe-size.js";
import { ResolutionEvidence } from "../packages/mokly/src/sidecar/resolution-evidence.js";

import {
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";
import { planCapture } from "./helpers/plan_capture.js";

test("the combined plan bound counts escaped specifiers and shared paths at the exact byte limit", () => {
  const plan: ResolutionPlan = {
    paths: ['quoted"\\é💾\u0001\ud800', 'importer"\\é💾\udc00'],
    imports: [[1, 'specifier"\\é💾\udc00', "import-statement", 0, false]],
    candidates: [[0, ['candidate"\u0001', "other"]]],
  };
  const evidence = { complete: true, durable: true, inputs: {} };
  const bytes = Buffer.byteLength(JSON.stringify([plan, evidence]));
  plan.paths[0] += "x".repeat(8 * 1024 * 1024 - bytes);
  assert.deepEqual(capturedPlan(plan, evidence), plan);
  plan.paths[0] += "x";
  assert.equal(capturedPlan(plan, evidence), undefined);
});

test("a response drops its optional plan before its unchanged reuse evidence", () => {
  const params = nativeParams("/source");
  const evidence = { complete: true, durable: true, inputs: {} };
  const compiled: CompiledGeneration = {
    toolchain: "fixture",
    identity: "identity",
    runtimeKey: "runtime",
    code: "module.exports={}",
    reuseEvidence: evidence,
    dependencyRoots: [],
    cssModules: [],
    sources: {},
    peers: {},
    inputs: {},
    metadataInputs: {},
    inputDirectories: {},
    metadataDirectories: {},
  };
  const result: BundleResult = {
    generation: "generation",
    modules: [],
    compiled,
    plan: {
      paths: ["importer", "x".repeat(4096)],
      imports: [[0, "edge", "import-statement", 1, true]],
    },
  };
  assert.doesNotThrow(() => checkRecipeSize(params, result, 2048));
  assert.equal(result.plan, undefined);
  assert.equal(result.compiled.reuseEvidence, evidence);
});

test("captured plans require complete durable evidence and fit the combined record bound", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "entry.mjs"),
    'export {value} from "./value.js";',
  );
  await write(path.join(root, "value.js"), 'export const value="original";');
  const params = nativeParams(root);
  const finish = context.mock.method(ResolutionEvidence.prototype, "finish");
  for (const [name, complete, durable, bytes, kept] of [
    ["complete stable capture", true, true, 0, true],
    ["incomplete", false, true, 0, false],
    ["unstable", true, false, 0, false],
    ["combined size", true, true, 8 * 1024 * 1024 - 100, false],
  ] as const) {
    finish.mock.mockImplementation(async () => ({
      complete,
      durable,
      inputs: bytes ? { ["x".repeat(bytes)]: { kind: "absent" } } : {},
    }));
    const captured = await bundle(params, build, undefined, planCapture(root));
    assert.equal(captured.result.plan !== undefined, kept, name);
    assert.equal(
      captured.result.compiled.reuseEvidence.complete,
      complete,
      name,
    );
    assert.equal(captured.result.compiled.reuseEvidence.durable, durable, name);
  }
});

test("a failed native attempt returns no captured plan after full resolution succeeds", async (context) => {
  const root = await nativeRoot(context);
  await write(path.join(root, "entry.mjs"), "export const value=1;");
  let attempts = 0;
  const captured = await bundle(
    nativeParams(root),
    (options) => {
      attempts++;
      if (attempts === 1) return Promise.reject(new Error("native failure"));
      return build(options);
    },
    undefined,
    planCapture(root),
  );
  assert.equal(attempts, 2);
  assert.equal(captured.result.plan, undefined);
  assert.equal(captured.result.compiled.reuseEvidence.complete, true);
});

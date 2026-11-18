import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import {
  currentEvidence,
  PhysicalInputs,
} from "../packages/mokly/src/sidecar/physical-inputs.js";

import {
  link,
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";
import { afterEvidence, capture } from "./helpers/sidecar_capture.js";

test("an intermediate link switch keeps live reuse but rejects a durable bundle", async (context) => {
  const root = await nativeRoot(context);
  await write(path.join(root, "entry.mjs"), 'export {value} from "chosen";');
  await write(path.join(root, "store/a/index.js"), 'exports.value="a";');
  await write(path.join(root, "store/b/index.js"), 'exports.value="b";');
  const current = path.join(root, "indirect/current");
  await link(path.join(root, "store/a"), current);
  await link(current, path.join(root, "node_modules/chosen"));
  let flips = 0;
  let attempts = 0;
  const compile: typeof build = async (options) => {
    attempts++;
    afterEvidence(options, async (args) => {
      if (args.path === "chosen" && flips === 0) {
        await fs.rm(current);
        await link(path.join(root, "store/b"), current);
        flips++;
      }
    });
    const result = await build(options);
    await fs.rm(current);
    await link(path.join(root, "store/a"), current);
    return result;
  };
  const params = nativeParams(root);
  const captured = await bundle(params, compile, undefined, capture());
  assert.equal(attempts, 1);
  assert.equal(flips, 1);
  assert.deepEqual(
    captured.result.modules.map((module) => module.path),
    ["entry.mjs", "store/b/index.js"],
  );
  const compiled = captured.result.compiled;
  assert.equal(compiled.reuseEvidence.complete, true);
  assert.equal(currentEvidence(compiled.reuseEvidence), true);
  assert.equal(compiled.reuseEvidence.durable, false);
  const reused = await reuse([captured.generation], params);
  assert.equal(reused?.compiled.runtimeKey, compiled.runtimeKey);
  assert.equal(reused?.compiled.identity, compiled.identity);
});

test("a directory-entry link witnesses every target parent through replacement and restoration", async (context) => {
  const root = await nativeRoot(context);
  const store = path.join(root, "hidden/store");
  const held = path.join(root, "hidden/held");
  const other = path.join(root, "other");
  await write(path.join(store, "a/index.js"), 'exports.value="a";');
  await write(path.join(other, "a/index.js"), 'exports.value="b";');
  const chosen = path.join(root, "listed/chosen");
  await link(path.join(store, "a"), chosen);
  const inputs = new PhysicalInputs(capture());
  inputs.directory(path.dirname(chosen));
  assert.equal(await fs.realpath(chosen), path.join(store, "a"));
  await fs.rename(store, held);
  await link(other, store);
  assert.equal(await fs.realpath(chosen), path.join(other, "a"));
  await fs.rm(store);
  await fs.rename(held, store);
  const evidence = await inputs.finish();
  assert.equal(await fs.realpath(chosen), path.join(store, "a"));
  assert.equal(evidence.complete, true);
  assert.equal(currentEvidence(evidence), true);
  assert.equal(evidence.durable, false);
});

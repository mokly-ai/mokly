import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";
import type { OnResolveArgs } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { CaptureDurability } from "../packages/mokly/src/sidecar/capture-durability.js";
import { captureRuntime } from "../packages/mokly/src/sidecar/capture-runtime.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import {
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";

function capture() {
  const now = BigInt(Date.now() + 10_000) * 1_000_000n;
  return new CaptureDurability(
    { volumes: [] },
    {
      ...captureRuntime,
      platform: "linux",
      now: () => now,
      filesystem: async () => 0xef53n,
    },
  );
}

/** Change a real directory only after the capture has observed this import. */
function afterEvidence(
  options: Parameters<typeof build>[0],
  change: (args: OnResolveArgs) => Promise<void>,
) {
  const plugin = options.plugins?.find(
    (plugin) => plugin.name === "mokly-reuse-evidence",
  );
  assert.ok(plugin);
  const setup = plugin.setup;
  plugin.setup = (builder) =>
    setup({
      ...builder,
      onResolve: (options, callback) =>
        builder.onResolve(options, async (args) => {
          const result = await callback(args);
          await change(args);
          return result;
        }),
    });
}

test("a transient higher candidate keeps live reuse but cannot produce a durable recipe", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "entry.mjs"),
    'export {value} from "./values/value";',
  );
  await write(
    path.join(root, "values/value.js"),
    'export const value="lower";',
  );
  const higher = path.join(root, "values/value.ts");
  const held = path.join(root, "values/held.ts");
  await write(higher, 'export const value="higher";');
  let flips = 0;
  let attempts = 0;
  const compile: typeof build = async (options) => {
    attempts++;
    afterEvidence(options, async (args) => {
      if (args.path === "./values/value" && flips === 0) {
        await fs.rename(higher, held);
        flips++;
      }
    });
    const result = await build(options);
    await fs.rename(held, higher);
    await fs.utimes(
      path.dirname(higher),
      new Date("2000-01-01"),
      new Date("2000-01-01"),
    );
    return result;
  };
  const params = nativeParams(root);
  const captured = await bundle(params, compile, undefined, capture());
  assert.equal(attempts, 1);
  assert.equal(flips, 1);
  assert.deepEqual(
    captured.result.modules.map((module) => module.path),
    ["entry.mjs", "values/value.js"],
  );
  assert.equal(captured.result.compiled.reuseEvidence.complete, true);
  assert.equal(captured.result.compiled.reuseEvidence.durable, false);
  assert.equal(
    (await reuse([captured.generation], params))?.compiled.runtimeKey,
    captured.generation.runtimeKey,
  );
});

test("an exact lookup witnesses the directory before esbuild caches a later open lookup", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "entry.mjs"),
    'import "./values/marker.ts"; export {value} from "./later.mjs";',
  );
  await write(path.join(root, "values/marker.ts"), "export const marker=1;");
  await write(
    path.join(root, "values/value.js"),
    'export const value="lower";',
  );
  await write(
    path.join(root, "later.mjs"),
    'export {value} from "./values/value";',
  );
  let changes = 0;
  let attempts = 0;
  let changed = () => {};
  const mutation = new Promise<void>((resolve) => {
    changed = resolve;
  });
  const compile: typeof build = async (options) => {
    attempts++;
    options.plugins?.unshift({
      name: "change-after-exact-resolution",
      setup(builder) {
        builder.onLoad({ filter: /marker\.ts$/ }, async () => {
          await write(
            path.join(root, "values/value.ts"),
            'export const value="higher";',
          );
          await fs.utimes(
            path.join(root, "values"),
            new Date("2000-01-01"),
            new Date("2000-01-01"),
          );
          changes++;
          changed();
          return undefined;
        });
        builder.onLoad({ filter: /later\.mjs$/ }, async () => {
          await mutation;
          return undefined;
        });
      },
    });
    return build(options);
  };
  const params = nativeParams(root);
  const captured = await bundle(params, compile, undefined, capture());
  assert.equal(attempts, 1);
  assert.equal(changes, 1);
  assert.deepEqual(
    captured.result.modules.map((module) => module.path),
    ["entry.mjs", "later.mjs", "values/marker.ts", "values/value.js"],
  );
  assert.equal(captured.result.compiled.reuseEvidence.complete, true);
  assert.equal(captured.result.compiled.reuseEvidence.durable, false);
  assert.equal(
    (await reuse([captured.generation], params))?.compiled.runtimeKey,
    captured.generation.runtimeKey,
  );
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import v8 from "node:v8";
import vm from "node:vm";

import { build } from "esbuild";
import type { Plugin } from "esbuild";

import type { BundleParams } from "../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { ResolutionPlan } from "../packages/mokly/src/generated/sidecar/ResolutionPlan.js";
import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { KeptContext } from "../packages/mokly/src/sidecar/kept-context.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";
import { Session } from "../packages/mokly/src/sidecar/session.js";

import {
  carries,
  countedKept,
  differingFields,
} from "./helpers/kept_context.js";
import { matureMetadata } from "./helpers/mature_metadata.js";
import {
  countedCompile,
  editFingerprint,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";
import { planCapture } from "./helpers/plan_capture.js";

/** The plan that the core keeps from a captured compile of these parameters. */
async function capturedPlan(
  params: BundleParams,
  root: string,
): Promise<ResolutionPlan> {
  const captured = await bundle(params, build, undefined, planCapture(root));
  assert.ok(captured.result.plan, "the captured compile must return its plan");
  return captured.result.plan;
}

/** A package whose extensionless relative import esbuild resolves itself in a guarded attempt. */
async function packageFixture(root: string) {
  const chain = path.join(root, "node_modules/chain");
  await packageAt(chain, "chain", 'export { value } from "./part";');
  await write(path.join(chain, "part.js"), "export const value = 1;");
  await write(path.join(root, "screen.mjs"), 'export const label = "one";');
  await write(
    path.join(root, "entry.mjs"),
    'export { value } from "chain";\nexport { label } from "./screen.mjs";',
  );
  return chain;
}

test("a failed guarded proof keeps the kept context, and the planned attempt compiles without it", async (context) => {
  matureMetadata(context);
  const root = await nativeRoot(context);
  // esbuild resolves the extensionless "./screen" itself in a guarded attempt.
  await write(path.join(root, "screen.js"), 'export const label = "one";');
  await write(
    path.join(root, "entry.mjs"),
    'export { label } from "./screen";',
  );
  const params = nativeParams(root);
  const plan = await capturedPlan(params, root);
  const { kept, counts } = countedKept();
  context.after(() => kept.dispose());
  const run = async (guarded: boolean) => {
    const counted = countedCompile();
    const { result } = await bundle(
      params,
      counted.compile,
      undefined,
      undefined,
      "serveEdit",
      plan,
      ...(guarded
        ? [(options: Parameters<typeof build>[0]) => kept.compile(options)]
        : []),
    );
    return {
      fingerprint: editFingerprint(result),
      fresh: counted.counts.compilations,
    };
  };
  assert.equal((await run(true)).fresh, 0, "the first guarded attempt stands");
  // A shadowing file that the plan does not know: esbuild now resolves "./screen" to screen.ts, so the proof fails.
  await write(path.join(root, "screen.ts"), 'export const label = "two";');
  const failed = await run(true);
  const reference = await run(false);
  assert.deepEqual(
    differingFields(failed.fingerprint, reference.fingerprint),
    [],
    "fields that differ from the same request without a kept context",
  );
  assert.deepEqual(
    { fresh: failed.fresh, created: counts.created, disposed: counts.disposed },
    { fresh: 1, created: 1, disposed: 0 },
  );
  await fs.rm(path.join(root, "screen.ts"));
  assert.deepEqual(
    { fresh: (await run(true)).fresh, created: counts.created },
    { fresh: 0, created: 1 },
  );
});

test("a released generation keeps the kept context, and shutdown disposes of it", async (context) => {
  matureMetadata(context);
  const root = await nativeRoot(context);
  await packageFixture(root);
  const params = nativeParams(root);
  const plan = await capturedPlan(params, root);
  const { kept, counts } = countedKept();
  // Ends the context also when an assertion fails before the shutdown.
  context.after(() => kept.dispose());
  const session = new Session(
    "test",
    () => {},
    build,
    () => {},
    unmeasured,
    () => {},
    undefined,
    undefined,
    kept,
  );
  await session.call({ id: 0, method: "hello", params: {} });
  const edit = async (id: number, label: string) => {
    await write(
      path.join(root, "screen.mjs"),
      `export const label = "${label}";`,
    );
    return (await session.call({
      id,
      method: "bundle",
      params: { ...params, capture: "serveEdit", plan },
    })) as { generation: string };
  };
  const first = await edit(1, "two");
  await session.call({
    id: 2,
    method: "dispose",
    params: { generation: first.generation },
  });
  await edit(3, "three");
  assert.deepEqual({ ...counts }, { created: 1, disposed: 0 });
  await session.call({ id: 4, method: "shutdown", params: {} });
  assert.deepEqual({ ...counts }, { created: 1, disposed: 1 });
});

/** Compile once with a plugin that holds a 1 MiB payload, and return a weak reference to it. */
async function compileWithPayload(
  kept: KeptContext,
  entry: string,
): Promise<WeakRef<object>> {
  const payload = { bytes: new Uint8Array(1 << 20) };
  const holder: Plugin = {
    name: "holder",
    setup(builder) {
      builder.onLoad({ filter: /entry\.mjs$/ }, () =>
        payload.bytes.length ? undefined : undefined,
      );
    },
  };
  await kept.compile({
    entryPoints: [entry],
    bundle: true,
    write: false,
    logLevel: "silent",
    plugins: [holder],
  });
  return new WeakRef(payload);
}

test("a kept context holds no request state after its rebuild", async (context) => {
  const root = await nativeRoot(context);
  const entry = path.join(root, "entry.mjs");
  await write(entry, "export const value = 1;");
  const kept = new KeptContext();
  context.after(() => kept.dispose());
  const reference = await compileWithPayload(kept, entry);
  await new Promise((resolve) => setImmediate(resolve));
  v8.setFlagsFromString("--expose-gc");
  (vm.runInNewContext("gc") as () => void)();
  assert.equal(
    reference.deref() === undefined,
    true,
    "the request payload stays reachable after the rebuild",
  );
});

test("a process keeps one kept context, and a replaced context is disposed", async (context) => {
  const root = await nativeRoot(context);
  await write(path.join(root, "a.mjs"), "export const a = 1;");
  await write(path.join(root, "b.mjs"), "export const b = 2;");
  const { kept, counts } = countedKept();
  context.after(() => kept.dispose());
  const live: number[] = [];
  for (const entry of ["a.mjs", "b.mjs", "a.mjs", "a.mjs"]) {
    await kept.compile({
      entryPoints: [path.join(root, entry)],
      bundle: true,
      write: false,
      logLevel: "silent",
    });
    live.push(counts.created - counts.disposed);
  }
  assert.deepEqual(
    { ...counts, live },
    { created: 3, disposed: 2, live: [1, 1, 1, 1] },
  );
});

test("a changed hook list replaces the kept context", async (context) => {
  const root = await nativeRoot(context);
  const entry = path.join(root, "entry.mjs");
  await write(entry, 'export { value } from "virtual:value";');
  const { kept, counts } = countedKept();
  context.after(() => kept.dispose());
  // `extra` adds one resolve hook ahead of the others, as a plan with more safe names adds filters.
  const plugin = (label: string, extra: boolean): Plugin => ({
    name: "values",
    setup(builder) {
      if (extra) builder.onResolve({ filter: /^unused:/ }, () => undefined);
      builder.onResolve({ filter: /^virtual:value$/ }, (args) => ({
        path: args.path,
        namespace: "values",
      }));
      builder.onLoad({ filter: /.*/, namespace: "values" }, () => ({
        contents: `export const value = ${JSON.stringify(label)};`,
        loader: "js",
      }));
    },
  });
  const viaKept: typeof build = (options) => kept.compile(options);
  const outputs = [
    await carries(viaKept, entry, plugin("first", false), "first"),
    await carries(viaKept, entry, plugin("second", false), "second"),
    await carries(viaKept, entry, plugin("third", true), "third"),
  ];
  assert.deepEqual(
    { outputs, ...counts },
    { outputs: [true, true, true], created: 2, disposed: 1 },
  );
});

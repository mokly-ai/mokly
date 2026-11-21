import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import { checkRecipeSize } from "../packages/mokly/src/sidecar/recipe-size.js";
import { Session } from "../packages/mokly/src/sidecar/session.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

async function fixture(context: TestContext) {
  const { head } = await sidecarSources(context);
  await fs.writeFile(
    path.join(head, "first.ts"),
    "export const value='first';",
  );
  await fs.writeFile(
    path.join(head, "second.ts"),
    "export const value='second';",
  );
  const firstParams = bundleParams({
    sourceRoot: head,
    entryFiles: ["first.ts"],
    storiesFiles: [],
    renderer: null,
    moduleResolution: { ...bundleParams().moduleResolution, packageRoots: [] },
  });
  const secondParams = { ...firstParams, entryFiles: ["second.ts"] };
  const source = startSidecar(context);
  await source.call("hello");
  const first = await source.call<BundleResult>("bundle", firstParams);
  const second = await source.call<BundleResult>("bundle", secondParams);
  assert.equal(first.compiled.reuseEvidence.complete, true);
  assert.equal(second.compiled.reuseEvidence.complete, true);
  const restored = startSidecar(context);
  await restored.call("hello");
  const install = (
    generation: string,
    params: typeof firstParams,
    result: BundleResult,
  ) =>
    restored.call("restoreGeneration", {
      generation,
      params,
      compiled: result.compiled,
      modules: result.modules,
    });
  return {
    head,
    firstParams,
    secondParams,
    first,
    second,
    source,
    restored,
    install,
  };
}

test("two restored compilations return short replies naming the selected restore", async (context) => {
  const { firstParams, secondParams, first, second, restored, install } =
    await fixture(context);
  await install("restore:first", firstParams, first);
  await install("restore:second", secondParams, second);
  assert.deepEqual(await restored.call("bundle", firstParams), {
    generation: first.generation,
    restoredGeneration: "restore:first",
  });
  assert.deepEqual(await restored.call("bundle", secondParams), {
    generation: second.generation,
    restoredGeneration: "restore:second",
  });
  assert.equal(restored.operations.length, 0);
});

test("duplicate restores keep loaded origins while fresh and memory reuse keep full replies", async (context) => {
  const {
    firstParams,
    secondParams,
    first,
    second,
    source,
    restored,
    install,
  } = await fixture(context);
  assert.equal(Object.hasOwn(first, "restoredGeneration"), false);
  const memory = await source.call<BundleResult>("bundle", firstParams);
  assert.equal(Object.hasOwn(memory, "restoredGeneration"), false);
  assert.deepEqual(memory.compiled, first.compiled);
  assert.deepEqual(memory.modules, first.modules);
  const before = source.operations.length;
  await source.call("restoreGeneration", {
    generation: first.generation,
    params: secondParams,
    compiled: second.compiled,
    modules: second.modules,
  });
  const ignored = await source.call<BundleResult>("bundle", firstParams);
  assert.equal(Object.hasOwn(ignored, "restoredGeneration"), false);
  assert.deepEqual(ignored.compiled, first.compiled);
  assert.equal(source.operations.length, before);
  await install("restore:duplicate", firstParams, first);
  await install("restore:duplicate", secondParams, second);
  assert.deepEqual(await restored.call("bundle", firstParams), {
    generation: first.generation,
    restoredGeneration: "restore:duplicate",
  });
  assert.equal(restored.operations.length, 0);
});

test("a restored compilation with changed inputs returns a full fresh reply", async (context) => {
  const { head, firstParams, first, restored, install } =
    await fixture(context);
  await install("restore:changed", firstParams, first);
  assert.deepEqual(await restored.call("bundle", firstParams), {
    generation: first.generation,
    restoredGeneration: "restore:changed",
  });
  await fs.writeFile(
    path.join(head, "first.ts"),
    "export const value='changed';",
  );
  const changed = await restored.call<BundleResult>("bundle", firstParams);
  assert.equal(Object.hasOwn(changed, "restoredGeneration"), false);
  assert.notEqual(changed.compiled.runtimeKey, first.compiled.runtimeKey);
  assert.notEqual(changed.generation, first.generation);
  assert.deepEqual(
    changed.modules.map((module) => module.path),
    ["first.ts"],
  );
  assert.ok(restored.operations.some((event) => event.operation === "esbuild"));
});

test("size-check evidence replacement keeps the full restored bundle reply", async (context) => {
  const { head, firstParams, first } = await fixture(context);
  const compiled = {
    ...first.compiled,
    reuseEvidence: {
      ...first.compiled.reuseEvidence,
      inputs: { ...first.compiled.reuseEvidence.inputs },
    },
  };
  for (let index = 0; index < 256; index += 1)
    compiled.reuseEvidence.inputs[
      path.join(head, `missing-${index}-${"x".repeat(200)}`)
    ] = { kind: "absent" };
  const reductions: boolean[] = [];
  const operations: string[] = [];
  const session = new Session(
    "fixture",
    () => {},
    undefined,
    (operation) => operations.push(operation),
    undefined,
    undefined,
    undefined,
    (params, result) => {
      const before = result.compiled.reuseEvidence;
      checkRecipeSize(params, result, 32 * 1024);
      reductions.push(before !== result.compiled.reuseEvidence);
    },
  );
  context.after(() => session.dispose());
  await session.call({ id: 0, method: "hello", params: {} });
  await session.call({
    id: 1,
    method: "restoreGeneration",
    params: {
      generation: "restore:size",
      params: firstParams,
      compiled,
      modules: first.modules,
    },
  });
  const result = await session.call({
    id: 2,
    method: "bundle",
    params: firstParams,
  });
  assert.deepEqual(result, {
    generation: first.generation,
    compiled: {
      ...compiled,
      reuseEvidence: { complete: false, durable: false, inputs: {} },
    },
    modules: first.modules,
    unmappedDependencyDirectories:
      first.compiled.unmappedDependencyDirectories ?? [],
  });
  assert.deepEqual(reductions, [true]);
  assert.deepEqual(operations, []);
});

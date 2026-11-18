import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { CaptureDurability } from "../packages/mokly/src/sidecar/capture-durability.js";
import { captureRuntime } from "../packages/mokly/src/sidecar/capture-runtime.js";
import { ResolutionEvidence } from "../packages/mokly/src/sidecar/resolution-evidence.js";
import { Session } from "../packages/mokly/src/sidecar/session.js";

import { startSidecar } from "./helpers/sidecar.js";
import { editSource } from "./helpers/sidecar_edit.js";

test("Serve edit compilation skips capture even when hello enables durability", async (context) => {
  const { params } = await editSource(context);
  const clock = context.mock.method(captureRuntime, "now");
  const durability = context.mock.method(
    CaptureDurability.prototype,
    "prepare",
  );
  const prepare = context.mock.method(ResolutionEvidence.prototype, "prepare");
  const peers = context.mock.method(ResolutionEvidence.prototype, "peers");
  const finish = context.mock.method(ResolutionEvidence.prototype, "finish");
  const plugins: string[][] = [];
  const session = new Session(
    "test",
    () => {},
    (options) => {
      plugins.push(options.plugins?.map((plugin) => plugin.name) ?? []);
      return build(options);
    },
  );
  context.after(() => session.dispose());
  await session.call({
    id: 0,
    method: "hello",
    params: { capture: { volumes: [] } },
  });
  const result = await session.call({
    id: 1,
    method: "bundle",
    params: { ...params, capture: "serveEdit" },
  });
  assert.ok(result && typeof result === "object" && "compiled" in result);
  const compiled = result.compiled;
  assert.ok(
    compiled && typeof compiled === "object" && "reuseEvidence" in compiled,
  );
  assert.deepEqual(compiled.reuseEvidence, {
    complete: false,
    durable: false,
    inputs: {},
    uncaptured: "serveEdit",
  });
  assert.equal(clock.mock.callCount(), 0, "no durability owner is constructed");
  assert.equal(durability.mock.callCount(), 0);
  assert.equal(prepare.mock.callCount(), 0);
  assert.equal(peers.mock.callCount(), 0);
  assert.equal(finish.mock.callCount(), 0);
  assert.ok(plugins.length > 0);
  assert.ok(plugins.every((names) => !names.includes("mokly-reuse-evidence")));
  const before = plugins.length;
  await session.call({ id: 2, method: "bundle", params });
  assert.ok(plugins.length > before, "a full request cannot reuse marked code");
  assert.equal(durability.mock.callCount(), 1);
  assert.equal(prepare.mock.callCount(), 1);
  assert.equal(peers.mock.callCount(), 1);
  assert.equal(finish.mock.callCount(), 1);
  assert.ok(
    plugins
      .slice(before)
      .every((names) => names.includes("mokly-reuse-evidence")),
  );
});

test("CSS and YAML edits reuse an uncaptured JavaScript edit and its seeded recipe", async (context) => {
  const { params, write } = await editSource(context);
  await write("card.module.css", ".card { color: red }");
  await write("entry.yaml", "title: Original");
  const entry = (value: string) =>
    `import map from './card.module.css'; export const value='${value}'; export {map};`;
  await write("entry.ts", entry("original"));
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  await sidecar.call<BundleResult>("bundle", params);
  await write("entry.ts", entry("changed"));
  const edited = await sidecar.call<BundleResult>("bundle", {
    ...params,
    evaluation: "javascript",
    capture: "serveEdit",
  });
  assert.deepEqual(edited.compiled.reuseEvidence, {
    complete: false,
    durable: false,
    inputs: {},
    uncaptured: "serveEdit",
  });
  const before = sidecar.operations.length;
  await write("card.module.css", ".card { color: blue }");
  const css = await sidecar.call<BundleResult>("bundle", {
    ...params,
    evaluation: "css",
    capture: "serveEdit",
  });
  assert.equal(css.compiled.runtimeKey, edited.compiled.runtimeKey);
  assert.notEqual(css.generation, edited.generation);
  assert.equal(sidecar.operations.length, before);
  await write("entry.yaml", "title: Changed");
  const yaml = await sidecar.call<BundleResult>("bundle", {
    ...params,
    evaluation: "yaml",
    capture: "serveEdit",
  });
  assert.equal(yaml.compiled.runtimeKey, edited.compiled.runtimeKey);
  assert.notEqual(yaml.generation, css.generation);
  assert.equal(sidecar.operations.length, before);
  const fresh = startSidecar(context);
  await fresh.call("hello");
  await fresh.call("restoreGeneration", {
    generation: edited.generation,
    params: { ...params, evaluation: "javascript" },
    compiled: edited.compiled,
    modules: edited.modules,
  });
  const seeded = await fresh.call<BundleResult>("bundle", {
    ...params,
    evaluation: "seeded",
    capture: "serveEdit",
  });
  assert.equal(seeded.compiled.runtimeKey, edited.compiled.runtimeKey);
  assert.equal(fresh.operations.length, 0);
  await sidecar.call("shutdown");
  await fresh.call("shutdown");
});

test("each uncaptured compilation has a fresh identity", async (context) => {
  const { params } = await editSource(context);
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  const second = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.notEqual(
    first.result.compiled.identity,
    second.result.compiled.identity,
  );
  assert.notEqual(first.result.generation, second.result.generation);
  assert.deepEqual(
    first.result.modules.map((module) => module.path),
    ["entry.ts"],
  );
  assert.deepEqual(first.result.compiled.reuseEvidence, {
    complete: false,
    durable: false,
    inputs: {},
    uncaptured: "serveEdit",
  });
});

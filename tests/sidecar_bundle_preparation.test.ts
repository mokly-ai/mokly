import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import { PostcssWorkers as PreparedWorkers } from "../packages/mokly/dist/sidecar/postcss.js";
import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import { PostcssWorkers } from "../packages/mokly/src/sidecar/postcss.js";
import { Session } from "../packages/mokly/src/sidecar/session.js";

import { preparedSession } from "./helpers/prepared_session.js";
import { contextParams, cssParams } from "./helpers/sidecar.js";
import { editSource } from "./helpers/sidecar_edit.js";

test("A bundle preparation changes neither the generation nor its reuse", async (context) => {
  const { params } = await editSource(context);
  let compilations = 0;
  const session = new Session(
    "test",
    () => {},
    (options) => {
      compilations++;
      return build(options);
    },
  );
  context.after(() => session.dispose());
  await session.call({ id: 0, method: "hello", params: {} });
  const prepared = await session.call({
    id: 1,
    method: "bundle",
    params: {
      ...params,
      capture: "serveEdit",
      preparation: { context: "attempt", postcss: "postcss.mjs" },
    },
  });
  assert.ok(
    prepared && typeof prepared === "object" && "generation" in prepared,
  );
  const plain = await session.call({
    id: 2,
    method: "bundle",
    params: { ...params, capture: "serveEdit" },
  });
  assert.ok(plain && typeof plain === "object" && "generation" in plain);
  assert.equal(plain.generation, prepared.generation);
  const before = compilations;
  const reused = await session.call({
    id: 3,
    method: "bundle",
    params: {
      ...params,
      capture: "serveEdit",
      preparation: { context: "next", postcss: "postcss.mjs" },
    },
  });
  assert.ok(reused && typeof reused === "object" && "generation" in reused);
  assert.equal(reused.generation, prepared.generation);
  assert.equal(compilations, before);
});

test("prepareContext starts preparation and answers while it is pending", async (context) => {
  const { params } = await editSource(context);
  const prepared: Array<Parameters<PostcssWorkers["prepare"]>[0]> = [];
  context.mock.method(
    PostcssWorkers.prototype,
    "prepare",
    (params: Parameters<PostcssWorkers["prepare"]>[0]) => {
      prepared.push(params);
      return new Promise<void>(() => {});
    },
  );
  const session = new Session("test", () => {});
  context.after(() => session.dispose());
  await session.call({ id: 0, method: "hello", params: {} });
  const request = {
    context: "attempt",
    postcss: "postcss.mjs",
    sourceRoot: params.sourceRoot,
    repositoryRoots: ["/workspace"],
    moduleResolution: params.moduleResolution,
  };
  const reply = await session.call({
    id: 1,
    method: "prepareContext",
    params: request,
  });
  assert.equal(reply, null);
  assert.deepEqual(prepared, [request]);
});

test("Bundle failure releases its prepared child before returning the error", async (context) => {
  const { params, write } = await editSource(context);
  await write("postcss.mjs", "export default {plugins:[]};");
  let childStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    childStarted = resolve;
  });
  let starts = 0;
  let stops = 0;
  const session = preparedSession(
    context,
    async () => {
      await started;
      throw new Error("fixture compilation failed");
    },
    (operation) => {
      if (operation === "postcss-start") {
        starts++;
        childStarted();
      }
      if (operation === "postcss-stop") stops++;
    },
  );
  context.after(() => session.dispose());
  await session.call({ id: 0, method: "hello", params: {} });
  const preparation = { context: "failed", postcss: "postcss.mjs" };
  await session.call({
    id: 1,
    method: "prepareContext",
    params: contextParams(params, preparation),
  });
  await assert.rejects(
    session.call({
      id: 2,
      method: "bundle",
      params: { ...params, preparation },
    }),
    { code: "bundle-failed", message: /fixture compilation failed/ },
  );
  assert.equal(starts, 1);
  assert.equal(stops, 1);
});

test("Session disposal during compilation stops preparation before compilation resumes", async (context) => {
  const { params, write } = await editSource(context);
  await write("postcss.mjs", "export default {plugins:[]};");
  let childStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    childStarted = resolve;
  });
  let compileEntered: () => void = () => {};
  const compiling = new Promise<void>((resolve) => {
    compileEntered = resolve;
  });
  let resume: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    resume = resolve;
  });
  let starts = 0;
  let stops = 0;
  const session = preparedSession(
    context,
    async (options) => {
      compileEntered();
      await held;
      return build(options);
    },
    (operation) => {
      if (operation === "postcss-start") {
        starts++;
        childStarted();
      }
      if (operation === "postcss-stop") stops++;
    },
  );
  context.after(() => session.dispose());
  await session.call({ id: 0, method: "hello", params: {} });
  const preparation = { context: "stopped", postcss: "postcss.mjs" };
  await session.call({
    id: 1,
    method: "prepareContext",
    params: contextParams(params, preparation),
  });
  const bundling = session.call({
    id: 2,
    method: "bundle",
    params: { ...params, preparation },
  });
  await Promise.all([started, compiling]);
  try {
    await session.dispose();
    assert.equal(starts, 1);
    assert.equal(stops, 1);
  } finally {
    resume();
    await bundling;
  }
  assert.equal(starts, 1);
});

test("A restored reuse with a prepared startup context replies short and keeps one child", async (context) => {
  const { params, write } = await editSource(context);
  await write("postcss.mjs", "export default {plugins:[]};");
  await write("theme.css", ".theme{color:red}");
  const source = preparedSession(context);
  await source.call({ id: 0, method: "hello", params: {} });
  const full = (await source.call({
    id: 1,
    method: "bundle",
    params: { ...params, capture: "full" },
  })) as BundleResult;
  let childStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    childStarted = resolve;
  });
  let starts = 0;
  const prepared: string[] = [];
  const prepare = PreparedWorkers.prototype.prepare;
  context.mock.method(
    PreparedWorkers.prototype,
    "prepare",
    function (this: PreparedWorkers, params: Parameters<typeof prepare>[0]) {
      prepared.push(params.context);
      return prepare.call(this, params);
    },
  );
  const restored = preparedSession(
    context,
    () => Promise.reject(new Error("a restored reuse must not compile")),
    (operation) => {
      if (operation !== "postcss-start") return;
      starts++;
      childStarted();
    },
  );
  await restored.call({ id: 0, method: "hello", params: {} });
  await restored.call({
    id: 1,
    method: "restoreGeneration",
    params: JSON.parse(
      JSON.stringify({
        generation: "restore:startup",
        params,
        compiled: full.compiled,
        modules: full.modules,
      }),
    ),
  });
  const preparation = { context: "startup", postcss: "postcss.mjs" };
  await restored.call({
    id: 2,
    method: "prepareContext",
    params: contextParams(params, preparation),
  });
  const reply = await restored.call({
    id: 3,
    method: "bundle",
    params: { ...params, capture: "full", preparation },
  });
  assert.deepEqual(reply, {
    generation: full.generation,
    restoredGeneration: "restore:startup",
  });
  assert.deepEqual(prepared, ["startup"]);
  await started;
  const css = await restored.call({
    id: 4,
    method: "processCss",
    params: cssParams({
      context: "startup",
      sourceRoot: params.sourceRoot,
      moduleResolution: params.moduleResolution,
      sourcePath: "theme.css",
      text: ".theme{color:red}",
    }),
  });
  assert.ok(css && typeof css === "object" && "text" in css);
  assert.equal(starts, 1);
});

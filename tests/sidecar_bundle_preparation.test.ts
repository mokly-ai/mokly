import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import { PostcssWorkers as PreparedWorkers } from "../packages/mokly/dist/sidecar/postcss.js";
import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import { PostcssWorkers } from "../packages/mokly/src/sidecar/postcss.js";
import { Session } from "../packages/mokly/src/sidecar/session.js";

import { preparedSession } from "./helpers/prepared_session.js";
import { cssParams } from "./helpers/sidecar.js";
import { editSource } from "./helpers/sidecar_edit.js";

test("Bundle starts preparation before compilation and does not await it", async (context) => {
  const { params } = await editSource(context);
  const events: string[] = [];
  const contexts: string[] = [];
  let completePreparation: () => void = () => {};
  const preparation = new Promise<void>((resolve) => {
    completePreparation = resolve;
  });
  context.mock.method(
    PostcssWorkers.prototype,
    "prepare",
    (params: Parameters<PostcssWorkers["prepare"]>[0]) => {
      events.push("prepare");
      contexts.push(params.context);
      return preparation;
    },
  );
  let compileEntered: () => void = () => {};
  const compiling = new Promise<void>((resolve) => {
    compileEntered = resolve;
  });
  let completeCompile: () => void = () => {};
  const compile = new Promise<void>((resolve) => {
    completeCompile = resolve;
  });
  const session = new Session(
    "test",
    () => {},
    async (options) => {
      events.push("compile");
      compileEntered();
      await compile;
      return build(options);
    },
  );
  context.after(() => session.dispose());
  await session.call({ id: 0, method: "hello", params: {} });
  const bundling = session.call({
    id: 1,
    method: "bundle",
    params: {
      ...params,
      capture: "serveEdit",
      preparation: { context: "attempt", postcss: "postcss.mjs" },
    },
  });
  await compiling;
  try {
    assert.deepEqual(events, ["prepare", "compile"]);
  } finally {
    completeCompile();
    await bundling;
  }
  const prepared = await bundling;
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
  const compilations = events.filter((event) => event === "compile").length;
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
  assert.deepEqual(contexts, ["attempt", "next"]);
  assert.equal(
    events.filter((event) => event === "compile").length,
    compilations,
  );
  completePreparation();
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
  await assert.rejects(
    session.call({
      id: 1,
      method: "bundle",
      params: {
        ...params,
        preparation: { context: "failed", postcss: "postcss.mjs" },
      },
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
  const bundling = session.call({
    id: 1,
    method: "bundle",
    params: {
      ...params,
      preparation: { context: "stopped", postcss: "postcss.mjs" },
    },
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

test("A restored reuse with a startup preparation starts the prepared child and replies short", async (context) => {
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
  const reply = await restored.call({
    id: 2,
    method: "bundle",
    params: {
      ...params,
      capture: "full",
      preparation: { context: "startup", postcss: "postcss.mjs" },
    },
  });
  assert.deepEqual(reply, {
    generation: full.generation,
    restoredGeneration: "restore:startup",
  });
  assert.deepEqual(prepared, ["startup"]);
  await started;
  const css = await restored.call({
    id: 3,
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

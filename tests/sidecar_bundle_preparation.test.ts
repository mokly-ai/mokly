import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import { PostcssWorkers } from "../packages/mokly/src/sidecar/postcss.js";
import { Session } from "../packages/mokly/src/sidecar/session.js";

import { preparedSession } from "./helpers/prepared_session.js";
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

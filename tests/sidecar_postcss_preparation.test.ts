import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { controlledPostcss } from "./helpers/postcss_workers.js";

test("preparation starts one child without processing a stylesheet", async (context) => {
  const { workers, children, messages, params } = controlledPostcss(context);
  await workers.prepare(params);
  assert.equal(children.length, 1);
  assert.deepEqual(messages, [
    {
      context: "css",
      postcss: path.resolve("repo/postcss.mjs"),
      sourceRoot: path.resolve("repo"),
      moduleResolution: params.moduleResolution,
      repositoryRoots: [],
    },
  ]);
  await workers.process({ ...params, text: "a{color:red}" });
  assert.equal(children.length, 1);
  assert.deepEqual(messages[1], {
    id: 1,
    params: {
      ...params,
      text: "a{color:red}",
      sourcePath: path.resolve("repo/input.css"),
    },
  });
});

test("a failed prepared child reaches its first request without a replacement", async (context) => {
  const { workers, children, params } = controlledPostcss(context);
  await workers.prepare(params);
  children[0]!.emit("error", new Error("fixture preparation failed"));
  await assert.rejects(workers.process(params), {
    code: "bundle-failed",
    message: "postcss.mjs: fixture preparation failed",
  });
  assert.equal(children.length, 1);
  await workers.process({ ...params, text: "new input" });
  assert.equal(children.length, 2);
});

test("configuration aliases use the same resolved physical module", async (context) => {
  const { workers, children, params } = controlledPostcss(context);
  context.mock.method(fs.promises, "realpath", async (file: unknown) =>
    String(file).replace("alias-postcss.mjs", "postcss.mjs"),
  );
  await workers.prepare({ ...params, postcss: "alias-postcss.mjs" });
  await workers.process(params);
  await workers.process({ ...params, postcss: "alias-postcss.mjs" });
  await workers.process(params);
  assert.equal(children.length, 1);
});

for (const previouslyUsed of [false, true])
  test(`a changed prepared identity ${previouslyUsed ? "retains used" : "releases unused"} workers`, async (context) => {
    const { workers, children, params } = controlledPostcss(context);
    let target = "first.mjs";
    context.mock.method(fs.promises, "realpath", async (file: unknown) =>
      String(file).replace("postcss.mjs", target),
    );
    if (previouslyUsed) await workers.process(params);
    await workers.prepare(params);
    target = "second.mjs";
    await workers.process(params);
    assert.equal(children.length, 2);
    assert.equal(children[0]!.exitCode, previouslyUsed ? null : 0);
    target = "first.mjs";
    await workers.process(params);
    assert.equal(children.length, previouslyUsed ? 2 : 3);
  });

for (const action of ["context", "session"] as const)
  test(`disposal of the ${action} prevents a pending lookup from forking`, async (context) => {
    const { workers, children, params } = controlledPostcss(context);
    let release: () => void = () => {};
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    context.mock.method(fs.promises, "realpath", async (file: unknown) => {
      entered();
      await waiting;
      return String(file);
    });
    const preparation = workers.prepare(params);
    await started;
    await workers.dispose(action === "context" ? params.context : undefined);
    release();
    await preparation;
    assert.equal(children.length, 0);
  });

import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { restore, reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { PhysicalInputReader } from "../packages/mokly/src/sidecar/physical-input-reader.js";

import { editSource } from "./helpers/sidecar_edit.js";

test("Serve edits prefer a captured recipe before an earlier marked recipe", async (context) => {
  const { params } = await editSource(context);
  const edit = await bundle(params, build, undefined, undefined, "serveEdit");
  const captured = await bundle(params, build);
  const selected = await reuse(
    [edit.generation, captured.generation],
    params,
    "serveEdit",
  );
  assert.equal(selected?.runtimeKey, captured.generation.runtimeKey);
  assert.equal(await reuse([edit.generation], params), undefined);
});

test("marked recipes keep settings, roots, source, metadata, and directory reuse checks", async (context) => {
  const { root, params, write } = await editSource(context);
  const edit = await bundle(params, build, undefined, undefined, "serveEdit");
  const unchanged = await reuse([edit.generation], params, "serveEdit");
  assert.equal(unchanged?.runtimeKey, edit.generation.runtimeKey);
  assert.equal(
    await reuse(
      [edit.generation],
      { ...params, renderer: "other.ts" },
      "serveEdit",
    ),
    undefined,
  );
  const wrongRoots = restore(
    params,
    {
      ...edit.result.compiled,
      dependencyRoots: [root],
    },
    edit.result.modules,
  );
  assert.equal(await reuse([wrongRoots], params, "serveEdit"), undefined);
  await write("entry.ts", "export const value='changed';");
  assert.equal(await reuse([edit.generation], params, "serveEdit"), undefined);
  await write("entry.ts", "export const value='original';");
  await write("package.json", '{"name":"changed"}');
  assert.equal(await reuse([edit.generation], params, "serveEdit"), undefined);
  await write("package.json", '{"name":"edit-fixture"}');
  await write("new.ts", "export const value=1;");
  assert.equal(await reuse([edit.generation], params, "serveEdit"), undefined);
});

test("Serve edits reject malformed markers and missing or foreign toolchains", async (context) => {
  const { params } = await editSource(context);
  const edit = await bundle(params, build, undefined, undefined, "serveEdit");
  const compilation = edit.result.compiled;
  for (const compiled of [
    { ...compilation, toolchain: "" },
    { ...compilation, toolchain: "foreign-toolchain" },
    {
      ...compilation,
      reuseEvidence: { complete: false, durable: false, inputs: {} },
    },
    {
      ...compilation,
      reuseEvidence: { ...compilation.reuseEvidence, complete: true },
    },
    {
      ...compilation,
      reuseEvidence: { ...compilation.reuseEvidence, durable: true },
    },
    {
      ...compilation,
      reuseEvidence: {
        ...compilation.reuseEvidence,
        inputs: { unexpected: { kind: "filePath" as const } },
      },
    },
    {
      ...compilation,
      reuseEvidence: {
        ...compilation.reuseEvidence,
        inputs: { unexpected: { kind: "directory" as const, entries: [] } },
      },
    },
  ]) {
    const candidate = restore(params, compiled, edit.result.modules);
    assert.equal(await reuse([candidate], params, "serveEdit"), undefined);
  }
});

test("source and directory changes reject captured reuse before physical evidence reads", async (context) => {
  const { params, write } = await editSource(context);
  const captured = await bundle(params, build);
  const current = context.mock.method(PhysicalInputReader.prototype, "current");
  await write("entry.ts", "export const value='changed';");
  assert.equal(await reuse([captured.generation], params), undefined);
  assert.equal(current.mock.callCount(), 0);
  await write("entry.ts", "export const value='original';");
  await write("new.ts", "export const value=1;");
  assert.equal(await reuse([captured.generation], params), undefined);
  assert.equal(current.mock.callCount(), 0);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { ModulePaths } from "../packages/mokly/src/sidecar/module-paths.js";
import {
  currentEvidence,
  PhysicalInputs,
} from "../packages/mokly/src/sidecar/physical-inputs.js";
import { ResolutionEvidence } from "../packages/mokly/src/sidecar/resolution-evidence.js";

import { bundleParams } from "./helpers/sidecar.js";

async function source(context: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-input-capture-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (name: string, text: string) => {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
  };
  const params = bundleParams({
    sourceRoot: root,
    entryFiles: ["entry.ts"],
    renderer: null,
    storiesFiles: [],
    moduleResolution: { ...bundleParams().moduleResolution, packageRoots: [] },
  });
  return { root, write, params };
}

for (const link of [false, true]) {
  test(`a ${link ? "link" : "config"} change during compilation cannot validate captured code`, async (context) => {
    const { root, write, params } = await source(context);
    await write("old/index.ts", "export const value='old';");
    await write("new/index.ts", "export const value='new';");
    let change: () => Promise<void>;
    if (link) {
      await write("entry.ts", "export {value} from './chosen';");
      const chosen = path.join(root, "chosen");
      await fs.symlink(path.join(root, "old"), chosen, "junction");
      change = async () => {
        await fs.rm(chosen);
        await fs.symlink(path.join(root, "new"), chosen, "junction");
      };
    } else {
      await write("entry.ts", "export {value} from 'chosen';");
      await write(
        "jsconfig.json",
        '{"compilerOptions":{"paths":{"chosen":["./old/index.ts"]}}}',
      );
      change = () =>
        write(
          "jsconfig.json",
          '{"compilerOptions":{"paths":{"chosen":["./new/index.ts"]}}}',
        );
    }
    const compile: typeof build = async (options) => {
      const result = await build(options);
      await change();
      return result;
    };
    const captured = await bundle(params, compile);
    assert.deepEqual(
      captured.result.modules.map((module) => module.path),
      ["entry.ts", "old/index.ts"],
    );
    assert.equal(captured.result.compiled.reuseEvidence.complete, false);
    assert.equal(await reuse([captured.generation], params), undefined);
    const current = await bundle(params, build);
    assert.deepEqual(
      current.result.modules.map((module) => module.path),
      ["entry.ts", "new/index.ts"],
    );
    assert.equal(current.result.compiled.reuseEvidence.complete, true);
  });
}

test("unsupported config evidence disables reuse without failing a valid compilation", async (context) => {
  const { write, params } = await source(context);
  await write("entry.ts", "export const value='valid';");
  await write("tsconfig.json", '{"extends":"fixture-config/base.json"}');
  await write(
    "node_modules/fixture-config/base.json",
    '{"compilerOptions":{}}',
  );
  const result = await bundle(params, build);
  assert.deepEqual(
    result.result.modules.map((module) => module.path),
    ["entry.ts"],
  );
  assert.equal(result.result.compiled.reuseEvidence.complete, false);
  assert.equal(await reuse([result.generation], params), undefined);
  const next = await bundle(params, build);
  assert.notEqual(
    next.result.generation,
    result.result.generation,
    "incomplete compiles must not alias an evaluated generation",
  );
});

test("evidence dropped for the frame bound gives each compilation a fresh generation", async (context) => {
  const { write, params } = await source(context);
  await write("entry.ts", "export const value=1;");
  const original = Buffer.byteLength;
  context.mock.method(
    Buffer,
    "byteLength",
    (...args: Parameters<typeof Buffer.byteLength>) => {
      const [value] = args;
      if (
        typeof value === "string" &&
        value.startsWith('{"id":') &&
        value.includes('"reuseEvidence":{"complete":true,')
      )
        return 64 * 1024 * 1024 + 1;
      return original(...args);
    },
  );
  const first = await bundle(params, build);
  const next = await bundle(params, build);
  assert.deepEqual(first.result.compiled.reuseEvidence, {
    complete: false,
    inputs: {},
  });
  assert.deepEqual(next.result.compiled.reuseEvidence, {
    complete: false,
    inputs: {},
  });
  assert.notEqual(first.result.generation, next.result.generation);
  assert.equal(await reuse([first.generation], params), undefined);
});

test("duplicate resolution requests keep complete evidence without depending on queue scheduling", async (context) => {
  const { root, write, params } = await source(context);
  await write("entry.ts", "export const value=1;");
  const evidence = new ResolutionEvidence(
    params,
    await ModulePaths.create(params),
  );
  await Promise.all(
    Array.from({ length: 5000 }, () => evidence.record("./entry.ts", root)),
  );
  assert.equal(evidence.physical.complete, true);
});

test("a grown directory rejects reuse before resolving an excess link", async (context) => {
  const { root } = await source(context);
  const directory = path.join(root, "directory");
  const target = path.join(root, "target");
  await fs.mkdir(directory);
  await fs.mkdir(target);
  await fs.symlink(target, path.join(directory, "alias"), "junction");
  const selected = await fs.realpath(target);
  const directoryKey = await fs.realpath(directory);
  const original = fs.realpath;
  let reads = 0;
  let canonicalReads = 0;
  context.mock.method(
    fs,
    "realpath",
    (...args: Parameters<typeof fs.realpath>) => {
      if (args[0] === directoryKey) canonicalReads++;
      else reads++;
      return original(...args);
    },
  );
  assert.equal(
    await currentEvidence({
      complete: true,
      inputs: {
        [directoryKey]: {
          kind: "directory",
          entries: [{ name: "alias", kind: "link", target: selected }],
        },
      },
    }),
    true,
  );
  assert.equal(reads, 1);
  assert.equal(canonicalReads, 1);
  reads = 0;
  canonicalReads = 0;
  assert.equal(
    await currentEvidence({
      complete: true,
      inputs: { [directoryKey]: { kind: "directory", entries: [] } },
    }),
    false,
  );
  assert.equal(reads, 0, "the excess entry must not resolve its link target");
  assert.equal(canonicalReads, 0);
});

test("metadata capture stops at its total byte bound before retaining another parsed file", async (context) => {
  const { root, write } = await source(context);
  const text = JSON.stringify({
    name: "captured",
    payload: ".".repeat(600 * 1024),
  });
  const inputs = new PhysicalInputs();
  for (let index = 0; index < 14; index++) await write(`${index}.json`, text);
  for (let index = 0; index < 13; index++)
    assert.equal(
      (await inputs.json(path.join(root, `${index}.json`)))?.name,
      "captured",
    );
  assert.equal(inputs.complete, true);
  assert.equal(await inputs.json(path.join(root, "13.json")), undefined);
  assert.equal(inputs.complete, false);
  assert.ok(inputs.usage.metadataBytes <= 8 * 1024 * 1024);
});

test("canonical file records reject an introduced source directory link", async (context) => {
  const { root, write } = await source(context);
  const text = "export {value} from '../value.ts';";
  await write("chosen/source.ts", text);
  await write("value.ts", "export const value='old';");
  await write("changed/nested/source.ts", text);
  await write("changed/value.ts", "export const value='new';");
  const file = path.join(root, "chosen/source.ts");
  const paths = new PhysicalInputs();
  const contents = new PhysicalInputs();
  const directories = new PhysicalInputs();
  assert.equal(await paths.exactFile(file), true);
  await contents.file(file);
  await directories.directory(path.dirname(file));
  const records = await Promise.all([
    paths.finish(),
    contents.finish(),
    directories.finish(),
  ]);
  assert.deepEqual(await Promise.all(records.map(currentEvidence)), [
    true,
    true,
    true,
  ]);
  await fs.rename(path.join(root, "chosen"), path.join(root, "retained"));
  await fs.symlink(
    path.join(root, "changed/nested"),
    path.join(root, "chosen"),
    "junction",
  );
  assert.deepEqual(await Promise.all(records.map(currentEvidence)), [
    false,
    false,
    false,
  ]);
});

test("exact file observations upgrade to bounded metadata content", async (context) => {
  const { root, write } = await source(context);
  await write("entry.ts", "export const value=1;");
  const file = path.join(root, "entry.ts");
  const inputs = new PhysicalInputs();
  assert.equal(await inputs.exactFile(file), true);
  await inputs.file(file);
  const captured = await inputs.finish();
  assert.equal(captured.complete, true);
  await write("entry.ts", "export const value=2;");
  assert.equal(await currentEvidence(captured), false);
  const bounded = new PhysicalInputs();
  assert.equal(await bounded.exactFile(file), true);
  const original = Buffer.byteLength;
  context.mock.method(
    Buffer,
    "byteLength",
    (...args: Parameters<typeof Buffer.byteLength>) => {
      const [value] = args;
      return typeof value === "string" && value.includes('"kind":"file"')
        ? 8 * 1024 * 1024
        : original(...args);
    },
  );
  await bounded.file(file);
  assert.equal((await bounded.finish()).complete, false);
});

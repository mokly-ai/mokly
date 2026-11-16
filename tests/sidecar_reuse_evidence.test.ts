import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";

async function fixture(context: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-reuse-inputs-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (name: string, contents: string) => {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
  };
  await write("entry.ts", "export const value='original';");
  const params = bundleParams({
    sourceRoot: root,
    entryFiles: ["entry.ts"],
    storiesFiles: [],
    renderer: null,
    moduleResolution: { ...bundleParams().moduleResolution, packageRoots: [] },
  });
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  return { root, write, params, sidecar };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
type InputCase = {
  name: string;
  prepare(fixture: Fixture): Promise<() => Promise<void>>;
  module?: string;
};

const cases: InputCase[] = [
  {
    name: "a new config candidate above sourceRoot",
    async prepare({ root, params, write }) {
      params.sourceRoot = path.join(root, "source");
      await write("source/entry.ts", "export const value='original';");
      return () =>
        write("jsconfig.json", '{"compilerOptions":{"alwaysStrict":true}}');
    },
  },
  {
    name: "jsconfig content",
    async prepare({ write }) {
      await write("jsconfig.json", '{"compilerOptions":{}}');
      return () =>
        write("jsconfig.json", '{"compilerOptions":{"alwaysStrict":true}}');
    },
  },
  {
    name: "a tsconfig extends target",
    async prepare({ write }) {
      await write("tsconfig.json", '{"extends":"./settings/base.json"}');
      await write(
        "settings/base.json",
        '{"compilerOptions":{"target":"es2022"}}',
      );
      return () =>
        write("settings/base.json", '{"compilerOptions":{"target":"es2020"}}');
    },
  },
  {
    name: "a non-React peer manifest",
    async prepare({ write }) {
      await write(
        "node_modules/react-dom/package.json",
        '{"name":"react-dom","main":"index.js","version":"1"}',
      );
      await write("node_modules/react-dom/index.js", "module.exports={};");
      return () =>
        write(
          "node_modules/react-dom/package.json",
          '{"name":"react-dom","main":"index.js","version":"2"}',
        );
    },
  },
  {
    name: "an extension candidate before a consumed index",
    module: "lib/item.ts",
    async prepare({ write }) {
      await write("entry.ts", "export {value} from './lib/item';");
      await write("lib/item/index.ts", "export const value='index';");
      return () => write("lib/item.ts", "export const value='extension';");
    },
  },
  {
    name: "an earlier paths target",
    module: "first/item.ts",
    async prepare({ write }) {
      await write("entry.ts", "export {value} from 'chosen';");
      await write(
        "tsconfig.json",
        '{"compilerOptions":{"baseUrl":".","paths":{"chosen":["first/item","second/item"]}}}',
      );
      await write("second/item.ts", "export const value='second';");
      return () => write("first/item.ts", "export const value='first';");
    },
  },
  {
    name: "a baseUrl candidate before a package",
    module: "aliases/chosen.ts",
    async prepare({ root, write }) {
      await write("entry.ts", "export {value} from 'chosen';");
      await write(
        "tsconfig.json",
        '{"compilerOptions":{"baseUrl":"./aliases"}}',
      );
      await fs.mkdir(path.join(root, "aliases"));
      await write("node_modules/chosen/index.js", "exports.value='package';");
      return () => write("aliases/chosen.ts", "export const value='baseUrl';");
    },
  },
  {
    name: "a nearer package directory",
    module: "src/node_modules/chosen/index.js",
    async prepare({ params, write }) {
      params.entryFiles = ["src/entry.ts"];
      await write("src/entry.ts", "export {value} from 'chosen';");
      await write("node_modules/chosen/index.js", "exports.value='far';");
      return () =>
        write("src/node_modules/chosen/index.js", "exports.value='near';");
    },
  },
  ...[false, true].map((packageLink): InputCase => ({
    name: packageLink
      ? "a pnpm package link with its old target retained"
      : "a source link with its old target retained",
    module: "store/new/index.ts",
    async prepare({ root, write }) {
      await write(
        "entry.ts",
        `export {value} from '${packageLink ? "chosen" : "./alias"}';`,
      );
      await write("store/old/index.ts", "export const value='old';");
      await write("store/new/index.ts", "export const value='new';");
      const link = path.join(
        root,
        packageLink ? "node_modules/chosen" : "alias",
      );
      await fs.mkdir(path.dirname(link), { recursive: true });
      await fs.symlink(path.join(root, "store/old"), link, "junction");
      return async () => {
        await fs.rm(link);
        await fs.symlink(path.join(root, "store/new"), link, "junction");
      };
    },
  })),
];

for (const input of cases) {
  test(`reuse recompiles after ${input.name} changes`, async (context) => {
    const value = await fixture(context);
    const change = await input.prepare(value);
    const { sidecar, params } = value;
    const original = await sidecar.call<BundleResult>("bundle", params);
    const operations = () =>
      sidecar.operations.filter((event) => event.operation === "esbuild")
        .length;
    const before = operations();
    assert.ok(before > 0);
    const unchanged = await sidecar.call<BundleResult>("bundle", params);
    assert.equal(unchanged.compiled.runtimeKey, original.compiled.runtimeKey);
    assert.equal(
      operations(),
      before,
      "unchanged supported evidence must reuse",
    );
    await change();
    const changed = await sidecar.call<BundleResult>("bundle", params);
    assert.ok(operations() > before, `changed ${input.name} must compile`);
    assert.deepEqual(
      changed.modules.map((module) => module.path),
      [
        ...new Set([
          ...params.entryFiles,
          ...(input.module ? [input.module] : []),
        ]),
      ].sort(),
    );
    await sidecar.call("shutdown");
  });
}

test("a fresh sidecar reuses an unchanged recipe and rejects foreign or incomplete evidence", async (context) => {
  const { sidecar, params } = await fixture(context);
  const original = await sidecar.call<BundleResult>("bundle", params);
  const fresh = startSidecar(context);
  await fresh.call("hello");
  const restore = (compiled: BundleResult["compiled"]) =>
    fresh.call("restoreGeneration", {
      generation: original.generation,
      params,
      compiled,
      modules: original.modules,
    });
  await restore(original.compiled);
  const reused = await fresh.call<BundleResult>("bundle", params);
  assert.equal(reused.compiled.runtimeKey, original.compiled.runtimeKey);
  assert.equal(fresh.operations.length, 0);
  await fresh.call("dispose", { generation: reused.generation });
  await restore({ ...original.compiled, toolchain: "foreign-toolchain" });
  const changed = await fresh.call<BundleResult>("bundle", params);
  assert.notEqual(changed.compiled.runtimeKey, original.compiled.runtimeKey);
  const before = fresh.operations.length;
  assert.ok(before > 0, "another toolchain must compile");
  await fresh.call("dispose", { generation: changed.generation });
  await restore({
    ...original.compiled,
    reuseEvidence: { complete: false, inputs: {} },
  });
  const incomplete = await fresh.call<BundleResult>("bundle", params);
  assert.notEqual(incomplete.compiled.runtimeKey, original.compiled.runtimeKey);
  assert.ok(
    fresh.operations.length > before,
    "incomplete evidence must compile",
  );
  await sidecar.call("shutdown");
  await fresh.call("shutdown");
});

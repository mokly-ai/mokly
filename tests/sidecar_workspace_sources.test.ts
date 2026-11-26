import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";
import { restore } from "../packages/mokly/src/sidecar/compiled.js";
import { ModulePaths } from "../packages/mokly/src/sidecar/module-paths.js";

import { link } from "./helpers/native_resolution.js";
import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

async function write(root: string, file: string, contents: string) {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}

async function workspace(context: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-workspace-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const head = path.join(root, "head");
  const base = path.join(root, "base");
  const modules = path.join(head, "node_modules");
  await fs.mkdir(modules, { recursive: true });
  await fs.symlink(
    path.join(head, "packages/local"),
    path.join(modules, "local"),
    "junction",
  );
  const params = (side: string, entry = "entry.mjs") =>
    bundleParams({
      sourceRoot: side,
      repositoryRoots: [head],
      entryFiles: [entry],
      storiesFiles: [],
      renderer: null,
      moduleResolution: {
        ...bundleParams().moduleResolution,
        packageRoots: [modules],
      },
    });
  return { head, base, params };
}

test("workspace JavaScript and CSS imports use each side's sources", async (context) => {
  const { head, base, params } = await workspace(context);
  const manifest = JSON.stringify({
    name: "local",
    exports: { ".": "./dist/page.js", "./theme.css": "./dist/theme.css" },
  });
  const sides = [
    [head, "Head", "src"],
    [base, "Base", "historical"],
  ] as const;
  await write(
    base,
    "packages/local/tsconfig.json",
    '{"compilerOptions":{"rootDir":"historical","outDir":"dist"}}',
  );
  for (const [side, text, sources] of sides) {
    await write(
      side,
      "entry.mjs",
      'export {page} from "local"; import "local/theme.css";',
    );
    await write(side, "packages/local/package.json", manifest);
    await write(
      side,
      `packages/local/${sources}/theme.css`,
      "body { color: blue; }",
    );
    await write(
      side,
      `packages/local/${sources}/page.ts`,
      `import {definePage} from "@mokly/mokly";
export const page = definePage({title:"Local",description:"",relatedDocs:[],render:()=>"<html>${text}</html>"});`,
    );
  }
  await write(
    head,
    "packages/local/dist/page.js",
    'export const page = "Built";',
  );
  await write(head, "packages/local/dist/theme.css", "body { color: red; }");
  for (const [side, text, sources] of sides) {
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    const { generation, modules, compiled } = await sidecar.call<BundleResult>(
      "bundle",
      params(side),
    );
    assert.deepEqual(modules.map((module) => module.path).sort(), [
      "entry.mjs",
      `packages/local/${sources}/page.ts`,
      `packages/local/${sources}/theme.css`,
    ]);
    for (const file of ["page.ts", "theme.css"])
      assert.equal(
        Object.hasOwn(
          compiled.metadataInputs,
          `packages/local/${sources}/${file}`,
        ),
        false,
      );
    await sidecar.call("cssModules", { generation, classMaps: {} });
    await installBindings(sidecar, generation);
    const result = await sidecar.call<PageResult>("renderPage", {
      generation,
      handle: "entry.mjs#page",
    });
    assert.equal(result.html, `<html>${text}</html>`);
    await sidecar.call("shutdown");
  }
});

test("a package without source uses its build or names its override", async (context) => {
  const { head, base, params } = await workspace(context);
  for (const side of [head, base]) {
    await write(side, "entry.mjs", 'export {value} from "local";');
    await write(
      side,
      "packages/local/package.json",
      '{"name":"workspace-local","exports":"./dist/value.js"}',
    );
  }
  await write(
    head,
    "packages/local/dist/value.js",
    'export const value = "Built";',
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<BundleResult>("bundle", params(head));
  assert.deepEqual(result.modules.map((module) => module.path).sort(), [
    "entry.mjs",
    "packages/local/dist/value.js",
  ]);
  await sidecar.call("shutdown");
  const historical = startSidecar(context);
  await historical.call("hello");
  await assert.rejects(historical.call("bundle", params(base)), {
    code: "bundle-failed",
    message:
      "entry.mjs:1:21: module packages/local/dist/value.js has no source in this side; set moduleResolution.sourcePackages for workspace-local",
  });
  await historical.call("shutdown");
});

test("Node-loaded requires suggest a source override for missing base builds", async (context) => {
  const { head, base, params } = await workspace(context);
  const manifest = '{"name":"workspace-local","exports":"./dist/value.cjs"}';
  for (const side of [head, base])
    await write(side, "packages/local/package.json", manifest);
  await write(base, "entry.mjs", 'export const value = "Entry";');
  await write(
    head,
    "packages/local/dist/value.cjs",
    'module.exports = "Built";',
  );

  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const inputs = params(base);
  inputs.moduleResolution.dependencyRoot = head;
  const result = await sidecar.call<BundleResult>("bundle", inputs);
  const runtime = restore(inputs, result.compiled, result.modules).require;
  assert.throws(() => runtime("local"), {
    message:
      "module packages/local/dist/value.cjs has no source in this side; set moduleResolution.sourcePackages for workspace-local",
  });
  await sidecar.call("shutdown");
});

test("workspace imports preserve configured files and relative build paths", async (context) => {
  const { head, params } = await workspace(context);
  const pkg = path.join(head, "packages/local");
  await write(
    head,
    "entry.mjs",
    'export {value} from "local"; export {other} from "./packages/local/lib/relative.mjs";',
  );
  await write(
    head,
    "packages/local/package.json",
    '{"name":"local","exports":"./dist/configured.mjs"}',
  );
  for (const [folder, file, name] of [
    ["release", "configured", "value"],
    ["lib", "relative", "other"],
  ]) {
    await write(
      head,
      `packages/local/${folder}/${file}.mjs`,
      `export const ${name} = "Built";`,
    );
    await write(
      head,
      `packages/local/src/${file}.ts`,
      `export const ${name} = "Source";`,
    );
  }
  await link(path.join(pkg, "release"), path.join(pkg, "dist"));
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<BundleResult>("bundle", {
    ...params(head),
    entryFiles: ["entry.mjs", "packages/local/release/configured.mjs"],
  });
  assert.deepEqual(result.modules.map((module) => module.path).sort(), [
    "entry.mjs",
    "packages/local/lib/relative.mjs",
    "packages/local/release/configured.mjs",
  ]);
  await sidecar.call("shutdown");
});

test("a workspace bundle changes when its package layout or source candidates change", async (context) => {
  const { head, params } = await workspace(context);
  const layout = (rootDir: string) =>
    JSON.stringify({ compilerOptions: { rootDir, outDir: "./compiled" } });
  await write(head, "entry.mjs", 'export {value} from "local";');
  await write(
    head,
    "packages/local/package.json",
    '{"name":"local","exports":"./compiled/value.js"}',
  );
  await write(
    head,
    "packages/local/tsconfig.json",
    '{"extends":"./layout.json"}',
  );
  await write(head, "packages/local/layout.json", layout("./first"));
  await write(
    head,
    "packages/local/compiled/value.js",
    'export const value = "Built";',
  );
  await write(
    head,
    "packages/local/first/value.ts",
    'export const value = "First";',
  );
  await write(
    head,
    "packages/local/second/value.ts",
    'export const value = "Second";',
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const inputs = params(head);
  const bundle = () => sidecar.call<BundleResult>("bundle", inputs);
  const names = (result: BundleResult) =>
    result.modules.map((module) => module.path).sort();
  const original = await bundle();
  assert.deepEqual(names(original), [
    "entry.mjs",
    "packages/local/first/value.ts",
  ]);
  assert.equal(
    original.compiled.metadataInputs["packages/local/first/value.tsx"],
    null,
  );
  assert.match(
    original.compiled.metadataInputs["packages/local/layout.json"] ?? "",
    /^[0-9a-f]{64}$/,
  );
  assert.equal(
    await (
      await ModulePaths.create(inputs)
    ).resolve(path.join(head, "packages/local/compiled/value.js"), "local"),
    await fs.realpath(path.join(head, "packages/local/first/value.ts")),
  );
  assert.equal(
    (await bundle()).compiled.runtimeKey,
    original.compiled.runtimeKey,
  );
  await write(
    head,
    "packages/local/first/value.tsx",
    'export const value = "New";',
  );
  assert.deepEqual(names(await bundle()), [
    "entry.mjs",
    "packages/local/first/value.tsx",
  ]);
  await write(head, "packages/local/layout.json", layout("./second"));
  assert.deepEqual(names(await bundle()), [
    "entry.mjs",
    "packages/local/second/value.ts",
  ]);
  await sidecar.call("shutdown");
});

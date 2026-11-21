import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { build } from "esbuild";

import { definitionData } from "../packages/mokly/src/authoring/runtime.js";
import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import {
  assetExtensions,
  assetModule,
  assetType,
  importedAssetPaths,
} from "../packages/mokly/src/sidecar/asset-imports.js";
import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { describe } from "../packages/mokly/src/sidecar/describe.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";

async function fixture(context: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-asset-import-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function compile(
  root: string,
  imports: string,
  expression: string,
  loaders: Record<string, string> = {},
) {
  await fs.writeFile(
    path.join(root, "entry.mjs"),
    `import {definePage} from "@mokly/mokly";
${imports}
export default definePage({title:"Assets",description:"",relatedDocs:[],render:()=>${expression}});`,
  );
  const params = bundleParams({
    sourceRoot: root,
    entryFiles: ["entry.mjs"],
    renderer: null,
    storiesFiles: [],
  });
  params.moduleResolution.loaders = loaders;
  const built = await bundle(params, build);
  built.generation.maps = {};
  await describe(built.generation);
  const data = definitionData(
    built.generation.handles.get("entry.mjs#default"),
  );
  assert.ok(data);
  const render = data.input.render;
  assert.ok(typeof render === "function");
  return { result: built.result, value: render() };
}

test("asset defaults export stable logical tokens and digest their original bytes", async (context) => {
  const root = await fixture(context);
  const png = Buffer.from([0, 255, 10, 128]);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  await fs.writeFile(path.join(root, "logo.png"), png);
  await fs.writeFile(path.join(root, "logo.svg"), svg);
  const imports = 'import png from "./logo.png"; import svg from "./logo.svg";';
  const before = await compile(root, imports, "[png, svg]");
  assert.deepEqual(before.value, [
    "mokly-asset:[logo.png]",
    "mokly-asset:[logo.svg]",
  ]);
  for (const [file, bytes] of [
    ["logo.png", png],
    ["logo.svg", svg],
  ] as const) {
    assert.deepEqual(
      before.result.modules.find((module) => module.path === file),
      {
        path: file,
        imports: [],
        digest: createHash("sha256").update(bytes).digest("hex"),
        importedAsset: true,
      },
    );
  }
  const edited = Buffer.from([1, 255, 10, 128]);
  await fs.writeFile(path.join(root, "logo.png"), edited);
  const after = await compile(root, imports, "[png, svg]");
  assert.deepEqual(after.value, before.value);
  assert.equal(
    after.result.modules.find((module) => module.path === "logo.png")?.digest,
    createHash("sha256").update(edited).digest("hex"),
  );
  assert.notEqual(after.result.generation, before.result.generation);
});

test("import and require return the same asset token in one bundle", async (context) => {
  const root = await fixture(context);
  await fs.writeFile(path.join(root, "logo.png"), Buffer.from([0, 255, 128]));
  const { value } = await compile(
    root,
    'import logo from "./logo.png"; const required = require("./logo.png");',
    "[logo, required]",
  );
  assert.deepEqual(value, ["mokly-asset:[logo.png]", "mokly-asset:[logo.png]"]);
});

test("consumer suffixes and explicit attributes precede the asset default", async (context) => {
  const cases: Array<{
    file: string;
    attribute?: string;
    loaders?: Record<string, string>;
    bytes: string;
    expression?: string;
    expected: unknown;
  }> = [
    {
      file: "value.png",
      loaders: { ".png": "text" },
      bytes: "text",
      expected: "text",
    },
    {
      file: "value.icon.png",
      loaders: { ".png": "binary", ".icon.png": "text" },
      bytes: "longest",
      expected: "longest",
    },
    {
      file: "value.png",
      attribute: "bytes",
      loaders: { ".png": "text" },
      bytes: "consumer",
      expected: "consumer",
    },
    {
      file: "value.png",
      attribute: "text",
      bytes: "attribute",
      expected: "attribute",
    },
    {
      file: "value.png",
      attribute: "bytes",
      bytes: "AB",
      expression: "Array.from(value)",
      expected: [65, 66],
    },
    {
      file: "value.png",
      attribute: "json",
      bytes: '{"name":"json"}',
      expected: { name: "json" },
    },
    {
      file: "value.json",
      attribute: "text",
      bytes: '{"name":"source"}',
      expected: { name: "source" },
    },
    { file: "value.txt", bytes: "plain text", expected: "plain text" },
  ];
  for (const scenario of cases) {
    const root = await fixture(context);
    await fs.writeFile(path.join(root, scenario.file), scenario.bytes);
    const attribute = scenario.attribute
      ? ` with {type:${JSON.stringify(scenario.attribute)}}`
      : "";
    const built = await compile(
      root,
      `import value from ${JSON.stringify("./" + scenario.file)}${attribute};`,
      scenario.expression ?? "value",
      scenario.loaders,
    );
    assert.deepEqual(built.value, scenario.expected, JSON.stringify(scenario));
    const module = built.result.modules.find(
      (module) => module.path === scenario.file,
    );
    assert.ok(module, JSON.stringify(scenario));
    assert.equal(module.importedAsset, undefined, JSON.stringify(scenario));
  }
});

test("a restored asset compilation reuses the captured module records", async (context) => {
  const root = await fixture(context);
  await fs.writeFile(path.join(root, "logo.png"), Buffer.from([0, 255, 128]));
  await fs.writeFile(
    path.join(root, "entry.mjs"),
    'export { default } from "./logo.png";',
  );
  const params = bundleParams({
    sourceRoot: root,
    entryFiles: ["entry.mjs"],
    renderer: null,
    storiesFiles: [],
  });
  const first = startSidecar(context);
  await first.call("hello");
  const original = await first.call<BundleResult>("bundle", params);
  await first.call("shutdown");

  const restored = startSidecar(context);
  await restored.call("hello");
  await restored.call("restoreGeneration", {
    params,
    generation: original.generation,
    compiled: original.compiled,
    modules: original.modules,
  });
  const reused = await restored.call<BundleResult>("bundle", {
    ...params,
    evaluation: "reused",
  });
  assert.deepEqual(reused.modules, original.modules);
  assert.equal(
    reused.modules.find((module) => module.path === "logo.png")?.importedAsset,
    true,
  );
  assert.equal(
    restored.operations.filter(({ operation }) => operation === "esbuild")
      .length,
    0,
  );
  await restored.call("shutdown");
});

test("file suffixes keep the existing error and unsupported types fail bundling", async (context) => {
  for (const suffix of [".png", ".icon.png"]) {
    const root = await fixture(context);
    const file = "value.icon.png";
    await fs.writeFile(path.join(root, file), "opaque");
    await assert.rejects(
      compile(root, `import value from "./${file}";`, "value", {
        [suffix]: "file",
      }),
      {
        code: "bundle-failed",
        message:
          /consumer graph emitted an undelivered file: value\.icon\.png; use a dataurl or binary loader for JavaScript assets instead of file/u,
      },
    );
  }
  for (const extension of ["unknown", "PNG"]) {
    const root = await fixture(context);
    await fs.writeFile(path.join(root, "value." + extension), "opaque");
    await assert.rejects(
      compile(root, `import value from "./value.${extension}";`, "value"),
      { code: "bundle-failed", message: /No loader is configured/u },
    );
  }
});

test("asset path sets belong to one compile and keep readable closed tokens", () => {
  const first = new Map<string, Uint8Array>();
  const second = new Map<string, Uint8Array>();
  assert.equal(
    assetModule("node_modules/@icons/logo.png", first),
    "mokly-asset:[node_modules/@icons/logo.png]",
  );
  assert.equal(
    assetModule("node_modules/@icons/logo.png", first),
    "mokly-asset:[node_modules/@icons/logo.png]",
  );
  assert.deepEqual(
    [...importedAssetPaths(first)],
    ["node_modules/@icons/logo.png"],
  );
  assert.deepEqual([...importedAssetPaths(second)], []);
});

test("Rust and TypeScript recognize the same case-sensitive JavaScript asset types", async () => {
  const rust = await fs.readFile(
    "crates/mokly-css/src/imported_assets.rs",
    "utf8",
  );
  const extensions = [
    ...rust.matchAll(/^\s*\("(\.[^"]+)", "[^"]+"\),$/gmu),
  ].map((match) => match[1]);
  assert.deepEqual(extensions.sort(), [...assetExtensions].sort());
  for (const extension of assetExtensions) {
    assert.equal(assetType("file" + extension), true, extension);
    assert.equal(assetType("file" + extension.toUpperCase()), false, extension);
  }
});

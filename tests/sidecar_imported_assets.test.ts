import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import {
  assetExtensions,
  assetModule,
  assetType,
  fileLoaderOnlyExtensions,
  importedAssetPaths,
} from "../packages/mokly/src/sidecar/asset-imports.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";
import { compile, fixture } from "./helpers/sidecar_assets.js";

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
  assert.deepEqual(await restored.call("bundle", params), {
    generation: original.generation,
    restoredGeneration: original.generation,
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
    "crates/mokly-content-types/src/lib.rs",
    "utf8",
  );
  const [defaults = "", fileOnly = ""] = rust.split(
    "const FILE_LOADER_ONLY_TYPES:",
  );
  const extensions = (tables: string) =>
    [...tables.matchAll(/\("(\.[^"]+)", "[^"]+"\)/gu)]
      .map((match) => match[1])
      .sort();
  assert.deepEqual(extensions(defaults), [...assetExtensions].sort());
  assert.deepEqual(extensions(fileOnly), [...fileLoaderOnlyExtensions].sort());
  for (const extension of assetExtensions) {
    assert.equal(assetType("file" + extension), true, extension);
    assert.equal(assetType("file" + extension.toUpperCase()), false, extension);
  }
  for (const extension of fileLoaderOnlyExtensions) {
    assert.equal(assetType("file" + extension), false, extension);
    assert.equal(assetType("file" + extension, "file"), true, extension);
    assert.equal(
      assetType("file" + extension.toUpperCase(), "file"),
      false,
      extension,
    );
  }
});

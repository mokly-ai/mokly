import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import { restore } from "../packages/mokly/src/sidecar/compiled.js";

import {
  link,
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";
import { startSidecar } from "./helpers/sidecar.js";

const manifest = {
  name: "workspace-local",
  exports: {
    ".": {
      types: "./dist/value.d.ts",
      import: "./dist/value.js",
      require: "./out/value.cjs",
    },
    "./theme.css": "./dist/theme.css",
    "./*": "./dist/wild/*.js",
  },
};

test("a clean head and an installed base resolve workspace JavaScript and CSS sources", async (context) => {
  const root = await nativeRoot(context);
  const head = path.join(root, "head");
  const base = path.join(root, "base");
  const installed = path.join(root, "installed-base");
  for (const [directory, value] of [
    [head, "Head"],
    [base, "Base"],
    [installed, "Install copy"],
  ] as const) {
    const pkg = path.join(directory, "packages/local");
    await write(path.join(pkg, "package.json"), JSON.stringify(manifest));
    await write(
      path.join(pkg, "src/value.ts"),
      `export const value = ${JSON.stringify(value)};`,
    );
    await write(path.join(pkg, "src/theme.css"), "body { color: blue; }");
    await write(
      path.join(directory, "entry.mjs"),
      'export {value} from "workspace-local"; import "workspace-local/theme.css";',
    );
  }
  for (const directory of [head, installed])
    await link(
      path.join(directory, "packages/local"),
      path.join(directory, "node_modules/workspace-local"),
    );

  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  for (const [params, value] of [
    [nativeParams(head), "Head"],
    [
      nativeParams(
        base,
        { repositoryRoots: [head, installed] },
        { dependencyRoot: installed, packageRoots: [installed] },
      ),
      "Base",
    ],
  ] as const) {
    const result = await sidecar.call<BundleResult>("bundle", params);
    assert.deepEqual(result.modules.map((module) => module.path).sort(), [
      "entry.mjs",
      "packages/local/src/theme.css",
      "packages/local/src/value.ts",
    ]);
    assert.match(result.compiled.code, new RegExp(`value = "${value}"`));
    assert.equal(
      result.compiled.metadataInputs["packages/local/dist/value.js"],
      null,
    );
    assert.equal(
      Object.hasOwn(
        result.compiled.metadataInputs,
        "packages/local/src/value.ts",
      ),
      false,
    );
  }
  await sidecar.call("shutdown");
});

test("a missing workspace build keeps the native error when exports select different sources", async (context) => {
  const root = await nativeRoot(context);
  const pkg = path.join(root, "packages/local");
  await write(
    path.join(pkg, "package.json"),
    JSON.stringify({
      name: "workspace-local",
      exports: { import: "./dist/first.js", require: "./dist/second.js" },
    }),
  );
  await write(path.join(pkg, "src/first.ts"), 'export const value = "First";');
  await write(
    path.join(pkg, "src/second.ts"),
    'export const value = "Second";',
  );
  await write(
    path.join(root, "entry.mjs"),
    'export {value} from "workspace-local";',
  );
  await link(pkg, path.join(root, "node_modules/workspace-local"));

  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  await assert.rejects(sidecar.call("bundle", nativeParams(root)), {
    code: "bundle-failed",
    message: /Could not resolve "workspace-local"/,
  });
  await sidecar.call("shutdown");
});

test("restored runtime requires resolve a workspace main field without a build", async (context) => {
  const root = await nativeRoot(context);
  const pkg = path.join(root, "packages/local");
  const source = path.join(pkg, "src/value.cjs");
  await write(
    path.join(pkg, "package.json"),
    '{"name":"workspace-local","main":"./dist/value.cjs"}',
  );
  await write(source, 'module.exports = "Source";');
  await write(path.join(root, "entry.mjs"), 'export const value = "Entry";');
  await link(pkg, path.join(root, "node_modules/workspace-local"));
  const params = nativeParams(root, {}, { resolveExtensions: [".cjs"] });

  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<BundleResult>("bundle", params);
  const generation = restore(params, result.compiled, result.modules);
  assert.equal(generation.require.resolve("workspace-local"), source);
  assert.equal(generation.require("workspace-local"), "Source");
  await sidecar.call("shutdown");
});

test("restored runtime requires keep a build on the head and recover on a base without it", async (context) => {
  const root = await nativeRoot(context);
  const head = path.join(root, "head");
  const base = path.join(root, "base");
  for (const side of [head, base]) {
    const pkg = path.join(side, "packages/local");
    await write(
      path.join(pkg, "package.json"),
      '{"name":"workspace-local","exports":"./dist/value.cjs"}',
    );
    await write(path.join(pkg, "src/value.cjs"), 'module.exports = "Source";');
    await write(path.join(side, "entry.mjs"), 'export const value = "Entry";');
  }
  await write(
    path.join(head, "packages/local/dist/value.cjs"),
    'module.exports = "Built";',
  );
  await link(
    path.join(head, "packages/local"),
    path.join(head, "node_modules/workspace-local"),
  );

  const resolution = { resolveExtensions: [".cjs"] };
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  for (const [params, file, value] of [
    [nativeParams(head, {}, resolution), "dist/value.cjs", "Built"],
    [
      nativeParams(
        base,
        { repositoryRoots: [head] },
        { ...resolution, dependencyRoot: head, packageRoots: [head] },
      ),
      "src/value.cjs",
      "Source",
    ],
  ] as const) {
    const result = await sidecar.call<BundleResult>("bundle", params);
    const runtime = restore(params, result.compiled, result.modules).require;
    assert.equal(
      runtime.resolve("workspace-local"),
      path.join(params.sourceRoot, "packages/local", file),
    );
    assert.equal(runtime("workspace-local"), value);
  }
  await sidecar.call("shutdown");
});

test("a restored runtime require keeps Node's error for an import-only export", async (context) => {
  const root = await nativeRoot(context);
  const pkg = path.join(root, "packages/local");
  await write(
    path.join(pkg, "package.json"),
    '{"name":"workspace-local","exports":{"import":"./dist/value.cjs"}}',
  );
  await write(path.join(pkg, "dist/value.cjs"), 'module.exports = "Built";');
  await write(path.join(pkg, "src/value.cjs"), 'module.exports = "Source";');
  await write(path.join(root, "entry.mjs"), 'export const value = "Entry";');
  await link(pkg, path.join(root, "node_modules/workspace-local"));
  const params = nativeParams(
    root,
    {},
    { resolveExtensions: [".cjs"], conditions: ["import"] },
  );

  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<BundleResult>("bundle", params);
  const runtime = restore(params, result.compiled, result.modules).require;
  assert.throws(() => runtime.resolve("workspace-local"), {
    code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
  });
  await sidecar.call("shutdown");
});

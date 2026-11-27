import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { restore } from "../packages/mokly/src/sidecar/compiled.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import {
  link,
  moduleNames,
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";

const name = "workspace-local";
const pkg = "packages/local";
const layout = { [name]: { esm: "source" } };
const baseBuild = "Base build";
const baseSource = "Base source";

for (const [scenario, sourcePackages, bundledFolder, bundledValue] of [
  ["no entry", [], "esm", baseBuild],
  ["a base entry of false", [{ [name]: false }, layout], "esm", baseBuild],
  ["a base layout", [layout], "source", baseSource],
] as const) {
  test(`a base with ${scenario} resolves its files when the working build is linked`, async (context) => {
    const root = await nativeRoot(context);
    const head = path.join(root, "head");
    const base = path.join(root, "base");
    for (const side of [head, base])
      await write(
        path.join(side, pkg, "package.json"),
        JSON.stringify({ name, exports: "./esm/value.cjs" }),
      );
    await write(
      path.join(head, pkg, "release/value.cjs"),
      'module.exports = "Working build";',
    );
    await link(path.join(head, pkg, "release"), path.join(head, pkg, "esm"));
    await link(path.join(head, pkg), path.join(head, "node_modules", name));
    await write(
      path.join(base, pkg, "esm/value.cjs"),
      'module.exports = "Base build";',
    );
    await write(
      path.join(base, pkg, "source/value.cjs"),
      'module.exports = "Base source";',
    );
    if (bundledFolder === "esm")
      await write(
        path.join(base, pkg, "release/value.cjs"),
        'module.exports = "Other base build";',
      );
    await write(
      path.join(base, "entry.mjs"),
      `export const value = require("${name}");`,
    );

    const params = nativeParams(
      base,
      { repositoryRoots: [head] },
      {
        dependencyRoot: head,
        packageRoots: [head],
        resolveExtensions: [".cjs"],
        sourcePackages: [...sourcePackages],
      },
    );
    const { result } = await bundle(params, build);
    const restored = restore(params, result.compiled, result.modules);
    assert.deepEqual(
      {
        modules: moduleNames(result).sort(),
        bundled: evaluate(restored).entries["entry.mjs"]?.value,
        resolved: restored.require.resolve(name),
        required: restored.require(name),
      },
      {
        modules: ["entry.mjs", `${pkg}/${bundledFolder}/value.cjs`],
        bundled: bundledValue,
        resolved: path.join(base, pkg, "esm/value.cjs"),
        required: baseBuild,
      },
    );
  });
}

test("identical export targets select source through a linked build folder", async (context) => {
  const root = await nativeRoot(context);
  const directory = path.join(root, pkg);
  await write(
    path.join(directory, "package.json"),
    JSON.stringify({
      name,
      exports: { import: "./esm/value.js", default: "./esm/value.js" },
    }),
  );
  await write(
    path.join(directory, "release/value.js"),
    'export const value = "Build";',
  );
  await write(
    path.join(directory, "source/value.ts"),
    'export const value = "Source";',
  );
  await link(path.join(directory, "release"), path.join(directory, "esm"));
  await link(directory, path.join(root, "node_modules", name));
  await write(path.join(root, "entry.mjs"), `export {value} from "${name}";`);

  const params = nativeParams(root, {}, { sourcePackages: [layout] });
  const { result } = await bundle(params, build);
  assert.deepEqual(moduleNames(result).sort(), [
    "entry.mjs",
    `${pkg}/source/value.ts`,
  ]);
});

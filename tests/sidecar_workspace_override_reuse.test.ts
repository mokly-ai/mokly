import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import {
  link,
  moduleNames,
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";

const name = "@example/ui";
const pkg = "packages/local";
const working = { [name]: { esm: "source" } };

for (const capture of ["serveEdit", "full"] as const) {
  test(`a ${capture} bundle invalidates workspace lookup misses when a candidate or manifest appears`, async (context) => {
    const root = await nativeRoot(context);
    const directory = path.join(root, pkg);
    const earlier = path.join(directory, "earlier/value.ts");
    const manifest = path.join(directory, "esm/package.json");
    await write(path.join(root, "entry.mjs"), 'export {value} from "local";');
    await write(
      path.join(directory, "package.json"),
      JSON.stringify({ name, exports: "./esm/value.js" }),
    );
    await write(
      path.join(directory, "esm/value.js"),
      'export const value = "Built";',
    );
    await write(
      path.join(directory, "source/value.ts"),
      'export const value = "Source";',
    );
    await link(directory, path.join(root, "node_modules/local"));

    const params = nativeParams(
      root,
      {},
      {
        sourcePackages: [{ [name]: { esm: "earlier" } }, working],
      },
    );
    const compile = () => bundle(params, build, undefined, undefined, capture);
    const first = await compile();
    assert.deepEqual(moduleNames(first.result).sort(), [
      "entry.mjs",
      "packages/local/source/value.ts",
    ]);
    for (const candidate of [earlier, manifest]) {
      assert.equal(
        first.result.compiled.reuseEvidence.inputs[candidate]?.kind,
        "absent",
        candidate,
      );
      assert.equal(
        first.result.compiled.metadataInputs[
          path.relative(root, candidate).split(path.sep).join("/")
        ],
        null,
      );
    }
    assert.equal(
      (await reuse([first.generation], params, capture))?.runtimeKey,
      first.generation.runtimeKey,
    );

    await write(earlier, 'export const value = "Earlier";');
    assert.equal(await reuse([first.generation], params, capture), undefined);
    const second = await compile();
    assert.deepEqual(moduleNames(second.result).sort(), [
      "entry.mjs",
      "packages/local/earlier/value.ts",
    ]);

    await write(manifest, '{"name":"other"}');
    assert.equal(await reuse([second.generation], params, capture), undefined);
    assert.deepEqual(moduleNames((await compile()).result).sort(), [
      "entry.mjs",
      "packages/local/esm/value.js",
    ]);
  });

  test(`a ${capture} bundle watches for a new manifest above a linked build without overrides`, async (context) => {
    const root = await nativeRoot(context);
    const directory = path.join(root, pkg);
    const manifestKey = `${pkg}/nested/package.json`;
    const manifest = path.join(root, manifestKey);
    await write(path.join(root, "entry.mjs"), 'export {value} from "local";');
    await write(
      path.join(directory, "package.json"),
      JSON.stringify({ name, exports: "./nested/dist/value.js" }),
    );
    await write(
      path.join(directory, "release/value.js"),
      'export const value = "Built";',
    );
    await write(
      path.join(directory, "nested/src/value.ts"),
      'export const value = "Source";',
    );
    await link(
      path.join(directory, "release"),
      path.join(directory, "nested/dist"),
    );
    await link(directory, path.join(root, "node_modules/local"));

    const params = nativeParams(root);
    const compile = () => bundle(params, build, undefined, undefined, capture);
    const first = await compile();
    assert.deepEqual(moduleNames(first.result).sort(), [
      "entry.mjs",
      `${pkg}/release/value.js`,
    ]);
    assert.equal(
      (await reuse([first.generation], params, capture))?.runtimeKey,
      first.generation.runtimeKey,
    );

    await write(manifest, '{"name":"nested"}');
    const reused = await reuse([first.generation], params, capture);
    const { result: second } = await compile();
    assert.deepEqual(
      {
        evidence: first.result.compiled.reuseEvidence.inputs[manifest]?.kind,
        metadata: first.result.compiled.metadataInputs[manifestKey],
        reused: reused !== undefined,
      },
      { evidence: "absent", metadata: null, reused: false },
    );
    assert.deepEqual(moduleNames(second).sort(), [
      "entry.mjs",
      `${pkg}/nested/src/value.ts`,
    ]);
    assert.equal(second.compiled.reuseEvidence.inputs[manifest]?.kind, "file");
    assert.match(
      second.compiled.metadataInputs[manifestKey] ?? "",
      /^[0-9a-f]{64}$/,
    );
  });
}

for (const [scenario, sourcePackages, buildFolder, selected] of [
  ["unused", [working], "esm", "source/value.ts"],
  ["kept by false", [{ [name]: false }], "esm", "esm/value.js"],
  ["linked without an override", [], "release", "release/value.js"],
] as const) {
  test(`a large workspace build ${scenario} keeps marked edit reuse`, async (context) => {
    const root = await nativeRoot(context);
    const directory = path.join(root, pkg);
    const built = path.join(directory, buildFolder, "value.js");
    await write(path.join(root, "entry.mjs"), 'export {value} from "local";');
    await write(
      path.join(directory, "package.json"),
      JSON.stringify({ name, exports: "./esm/value.js" }),
    );
    await write(
      built,
      `export const value = "Built"; /* ${"x".repeat(1_100_000)} */`,
    );
    await write(
      path.join(directory, "source/value.ts"),
      'export const value = "Source";',
    );
    if (buildFolder === "release")
      await link(
        path.join(directory, buildFolder),
        path.join(directory, "esm"),
      );
    await link(directory, path.join(root, "node_modules/local"));

    const params = nativeParams(
      root,
      {},
      { sourcePackages: [...sourcePackages] },
    );
    const { result, generation } = await bundle(
      params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    const reused = () => reuse([generation], params, "serveEdit");
    assert.deepEqual(moduleNames(result).sort(), [
      "entry.mjs",
      `${pkg}/${selected}`,
    ]);
    assert.equal(result.compiled.reuseEvidence.uncaptured, "serveEdit");
    assert.deepEqual(result.compiled.reuseEvidence.inputs[built], {
      kind: "filePath",
    });
    assert.equal((await reused())?.runtimeKey, generation.runtimeKey);

    await write(built, 'export const value = "Edited";');
    assert.equal(
      (await reused())?.runtimeKey,
      scenario === "unused" ? generation.runtimeKey : undefined,
    );
  });
}

test("a workspace build loaded by the restored Node require ends edit reuse after a content change", async (context) => {
  const root = await nativeRoot(context);
  const directory = path.join(root, pkg);
  const built = path.join(directory, "esm/value.cjs");
  await write(path.join(root, "entry.mjs"), 'export const value = "Entry";');
  await write(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: "react",
      version: "1.0.0",
      exports: { ".": "./esm/value.cjs", "./package.json": "./package.json" },
    }),
  );
  await write(built, 'module.exports = "Built";');
  await link(directory, path.join(root, "node_modules/react"));

  const params = nativeParams(root);
  const { result, generation } = await bundle(
    params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  const reused = () => reuse([generation], params, "serveEdit");
  assert.deepEqual(moduleNames(result), ["entry.mjs"]);
  assert.equal(generation.require("react"), "Built");
  assert.equal((await reused())?.runtimeKey, generation.runtimeKey);

  await write(built, 'module.exports = "Edit!";');
  assert.equal((await reused())?.runtimeKey, undefined);
  assert.equal(result.compiled.reuseEvidence.inputs[built]?.kind, "file");
});

for (const [scenario, setup, load] of [
  ["", "", "require(specifier)"],
  [" with require.call", "", "require.call(undefined, specifier)"],
  [" with require?.()", "", "require?.(specifier)"],
  [
    " with createRequire",
    'import { createRequire } from "node:module";',
    "createRequire(__filename)(specifier)",
  ],
]) {
  test(`a computed require${scenario} ends edit reuse when it loads the build of an import that selected source`, async (context) => {
    const root = await nativeRoot(context);
    const directory = path.join(root, pkg);
    const built = path.join(directory, "esm/value.js");
    await write(
      path.join(root, "entry.mjs"),
      `import { value } from "local";
      ${setup}
      const specifier = ["lo", "cal"].join("");
      export const observed = [value, ${load}];`,
    );
    await write(
      path.join(directory, "package.json"),
      JSON.stringify({ name, exports: "./esm/value.js" }),
    );
    await write(built, 'module.exports = "Built";');
    await write(
      path.join(directory, "source/value.ts"),
      'export const value = "Source";',
    );
    await link(directory, path.join(root, "node_modules/local"));

    const params = nativeParams(root, {}, { sourcePackages: [working] });
    const { result, generation } = await bundle(
      params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    const reused = () => reuse([generation], params, "serveEdit");
    assert.deepEqual(moduleNames(result).sort(), [
      "entry.mjs",
      `${pkg}/source/value.ts`,
    ]);
    assert.deepEqual(evaluate(generation).entries["entry.mjs"]?.observed, [
      "Source",
      "Built",
    ]);
    assert.equal((await reused())?.runtimeKey, generation.runtimeKey);

    await write(built, 'module.exports = "Edit!";');
    assert.equal((await reused())?.runtimeKey, undefined);
    assert.equal(result.compiled.reuseEvidence.inputs[built]?.kind, "file");
  });
}

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

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

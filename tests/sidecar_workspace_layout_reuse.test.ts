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

for (const capture of ["serveEdit", "full"] as const) {
  test(`a ${capture} bundle stops reusing a workspace layout miss after an inherited edit`, async (context) => {
    const root = await nativeRoot(context);
    const pkg = path.join(root, "packages/widget");
    const layout = path.join(pkg, "layout.json");
    const folders = (outDir: string) =>
      JSON.stringify({ compilerOptions: { rootDir: "./src", outDir } });
    await write(path.join(root, "entry.mjs"), 'export {value} from "widget";');
    await write(
      path.join(pkg, "package.json"),
      '{"name":"widget","exports":"./compiled/value.js"}',
    );
    await write(path.join(pkg, "tsconfig.json"), '{"extends":"./layout.json"}');
    await write(layout, folders("./other"));
    await write(
      path.join(pkg, "compiled/value.js"),
      'export const value = "Built";',
    );
    await write(
      path.join(pkg, "src/value.ts"),
      'export const value = "Source";',
    );
    await link(pkg, path.join(root, "node_modules/widget"));

    const params = nativeParams(root);
    const compile = () => bundle(params, build, undefined, undefined, capture);
    const first = await compile();
    assert.deepEqual(moduleNames(first.result).sort(), [
      "entry.mjs",
      "packages/widget/compiled/value.js",
    ]);
    const reused = () => reuse([first.generation], params, capture);
    assert.equal(
      (await reused())?.runtimeKey,
      first.result.compiled.runtimeKey,
    );

    await write(layout, folders("./compiled"));
    assert.equal((await reused())?.runtimeKey, undefined);
    assert.equal(
      first.result.compiled.reuseEvidence.inputs[layout]?.kind,
      "file",
    );
    assert.equal(
      Object.hasOwn(
        first.result.compiled.metadataInputs,
        "packages/widget/layout.json",
      ),
      false,
    );
    assert.deepEqual(moduleNames((await compile()).result).sort(), [
      "entry.mjs",
      "packages/widget/src/value.ts",
    ]);
  });
}

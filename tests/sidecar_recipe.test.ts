import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { CompiledGeneration } from "../packages/mokly/src/generated/sidecar/CompiledGeneration.js";
import {
  bundleResult,
  restore,
} from "../packages/mokly/src/sidecar/compiled.js";
import { checkRecipeSize } from "../packages/mokly/src/sidecar/recipe-size.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";

function compiled(): CompiledGeneration {
  return {
    identity: "compiled",
    code: "module.exports={}",
    runtimeKey: "private",
    dependencyRoots: [],
    cssModules: [],
    sources: {},
    peers: {},
    inputs: {},
    metadataInputs: {},
    inputDirectories: {},
    metadataDirectories: {},
  };
}

test("bundle recipes carry one module graph and fail with a typed size diagnostic", () => {
  const params = bundleParams();
  const recipe = compiled();
  const modules = [{ path: "entry.ts", imports: [] }];
  const result = bundleResult(restore(params, recipe, modules));
  assert.deepEqual(result.modules, modules);
  assert.ok(!Object.hasOwn(result.compiled!, "modules"));
  assert.throws(
    () => checkRecipeSize(params, result, 64),
    (error: unknown) => {
      assert.ok(
        error &&
          typeof error === "object" &&
          "code" in error &&
          "message" in error,
      );
      assert.equal(error.code, "bundle-failed");
      assert.match(
        String(error.message),
        /needs \d+ bytes\. The sidecar limit is 64 bytes/,
      );
      return true;
    },
  );
  checkRecipeSize(params, result);
});

test("failed peer resolution cannot fall through to a native parent installation", () => {
  const params = bundleParams();
  const native = createRequire(path.join(params.sourceRoot, "package.json"));
  assert.ok(native.resolve("react"));
  const recipe = compiled();
  recipe.peers.react = null;
  const generation = restore(params, recipe, []);
  for (const action of [
    () => generation.require("react"),
    () => generation.require.resolve("react"),
  ]) {
    assert.throws(action, { code: "MODULE_NOT_FOUND" });
  }
});

test("a failed peer lookup remains explicit in a real bundle recipe", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const params = bundleParams({
    entryFiles: ["screen.mockup.tsx"],
    renderer: null,
    storiesFiles: [],
  });
  params.moduleResolution.aliases["react/package.json"] =
    "missing-react-manifest";
  const native = createRequire(path.join(params.sourceRoot, "package.json"));
  assert.ok(native.resolve("react/package.json"));
  const result = await sidecar.call<BundleResult>("bundle", params);
  assert.equal(result.compiled?.peers["react/package.json"], null);
  assert.throws(
    () =>
      restore(params, result.compiled!, result.modules).require.resolve(
        "react/package.json",
      ),
    { code: "MODULE_NOT_FOUND" },
  );
});

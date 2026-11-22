import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { ResolutionPlan } from "../packages/mokly/src/generated/sidecar/ResolutionPlan.js";
import { bundle, bundleWith } from "../packages/mokly/src/sidecar/bundle.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";
import { PlanLookup } from "../packages/mokly/src/sidecar/resolution-plan.js";

import {
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

function entryValue(result: BundleResult): unknown {
  const module = { exports: {} };
  const execute = new Function(
    "module",
    "exports",
    result.compiled.code +
      '\nreturn module.exports.entries["entry.mjs"].value;',
  );
  const value: unknown = execute(module, module.exports);
  return value;
}

for (const [name, restore] of [
  ["the changed manifest remains", false],
  ["the original manifest is restored after compilation", true],
] as const)
  test(`a planned relative import retries its parse proof when ${name}`, async (context) => {
    const root = await nativeRoot(context);
    const library = await packageAt(
      path.join(root, "node_modules/lib"),
      "lib",
      'export { value } from "./impl.js";',
    );
    await write(
      path.join(library, "impl.js"),
      'import value from "./cjs.cjs"; export { value };',
    );
    await write(
      path.join(library, "cjs.cjs"),
      'exports.__esModule = true; exports.default = "cjs-default";',
    );
    await write(path.join(root, "entry.mjs"), 'export { value } from "lib";');
    const manifest = path.join(library, "package.json");
    const original = await fs.readFile(manifest, "utf8");
    const initialTime = new Date("2000-01-01T00:00:00.000Z");
    const changedTime = new Date("2001-01-01T00:00:00.000Z");
    const restoredTime = new Date("2002-01-01T00:00:00.000Z");
    await fs.utimes(manifest, initialTime, initialTime);
    const params = nativeParams(root);
    const plan: ResolutionPlan = {
      paths: [
        path.join(library, "index.mjs"),
        path.join(library, "impl.js"),
        path.join(library, "cjs.cjs"),
      ],
      imports: [
        [0, "./impl.js", "import-statement", 1, true],
        [1, "./cjs.cjs", "import-statement", 2, true],
      ],
    };
    let compiles = 0;
    const compile: typeof build = async (options) => {
      compiles++;
      if (compiles !== 1) return build(options);
      await fs.writeFile(
        manifest,
        '{"name":"lib","main":"index.mjs","type":"module"}',
      );
      await fs.utimes(manifest, changedTime, changedTime);
      const result = await build(options);
      if (restore) {
        await fs.writeFile(manifest, original);
        await fs.utimes(manifest, restoredTime, restoredTime);
      }
      return result;
    };
    const guarded = await bundle(
      params,
      compile,
      unmeasured,
      undefined,
      "serveEdit",
      plan,
    );
    const complete = await bundleWith(params, build, unmeasured, {
      mode: "planned",
      plan: new PlanLookup(plan),
    });
    assert.equal(entryValue(complete.result), "cjs-default");
    assert.equal(entryValue(guarded.result), "cjs-default");
    assert.equal(compiles, 2);
    assert.equal(
      guarded.result.compiled.code.replaceAll(
        guarded.result.compiled.runtimeKey,
        "mokly:runtime",
      ),
      complete.result.compiled.code.replaceAll(
        complete.result.compiled.runtimeKey,
        "mokly:runtime",
      ),
    );
  });

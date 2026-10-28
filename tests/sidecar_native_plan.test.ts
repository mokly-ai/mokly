import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { BundleParams } from "../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { Bundled } from "../packages/mokly/src/sidecar/bundle.js";
import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import {
  assertFullPathResult,
  countedCompile,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

/**
 * Each row gives esbuild's own resolver one per-file setting that a resolve
 * callback result never carries. The bundle must still equal the full path,
 * through a planned second compile.
 */
const rows: Array<{
  name: string;
  setup(head: string): Promise<BundleParams>;
  check?(bundled: Bundled): void;
}> = [
  {
    name: "a package type keeps bundler interop",
    async setup(head) {
      // The relative import resolves natively, so esbuild gives impl.js the
      // package type of esm-lib.
      await packageAt(
        path.join(head, "node_modules/esm-lib"),
        "esm-lib",
        'export { default } from "./impl.js";',
        "index.js",
      );
      await write(
        path.join(head, "node_modules/esm-lib/package.json"),
        JSON.stringify({ name: "esm-lib", main: "index.js", type: "module" }),
      );
      await write(
        path.join(head, "node_modules/esm-lib/impl.js"),
        'import value from "babel-cjs";\nexport default value;',
      );
      await packageAt(
        path.join(head, "node_modules/babel-cjs"),
        "babel-cjs",
        'Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = "babel default";',
        "index.js",
      );
      await write(
        path.join(head, "entry.mjs"),
        'export { default } from "esm-lib";',
      );
      return nativeParams(head);
    },
    check({ generation }) {
      generation.maps = {};
      // Node's rule for a "type": "module" importer gives the exports object.
      assert.equal(
        evaluate(generation).entries["entry.mjs"]!.default,
        "babel default",
      );
    },
  },
  {
    name: "a classic JSX tsconfig keeps the development runtime",
    async setup(head) {
      await write(
        path.join(head, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { jsx: "react", jsxFactory: "h" } }),
      );
      await write(
        path.join(head, "entry.jsx"),
        'import { Label } from "./label.jsx";\nexport const view = () => <Label />;',
      );
      await write(
        path.join(head, "label.jsx"),
        "export const Label = () => <b>Label</b>;",
      );
      return nativeParams(
        head,
        { entryFiles: ["entry.jsx"] },
        { packageRoots: [head, path.resolve(".")] },
      );
    },
    check({ result }) {
      assert.match(result.compiled!.code, /jsxDEV\(/);
      assert.doesNotMatch(result.compiled!.code, /\bh\(/);
    },
  },
  {
    name: "a module-only package keeps its module file for an import",
    async setup(head) {
      // Without main fields, esbuild keeps index.js as the fallback of the
      // import and switches to it because cjs-user requires the package.
      await write(
        path.join(head, "node_modules/dual/package.json"),
        JSON.stringify({ name: "dual", module: "esm.js" }),
      );
      await write(
        path.join(head, "node_modules/dual/esm.js"),
        'export default "module";',
      );
      await write(
        path.join(head, "node_modules/dual/index.js"),
        'module.exports = "main";',
      );
      await packageAt(
        path.join(head, "node_modules/esm-user"),
        "esm-user",
        'import value from "dual";\nexport default value;',
        "index.mjs",
      );
      await packageAt(
        path.join(head, "node_modules/cjs-user"),
        "cjs-user",
        'module.exports = require("dual");',
        "index.js",
      );
      await write(
        path.join(head, "entry.mjs"),
        'export { default } from "esm-user";\nexport { default as required } from "cjs-user";',
      );
      return nativeParams(head);
    },
    check({ result }) {
      assert.ok(
        result.modules.some(
          (module) => module.path === "node_modules/dual/esm.js",
        ),
      );
    },
  },
  {
    name: "a side-effect-free package keeps its flag",
    async setup(head) {
      // The tsconfig makes the native result inexact, so the planned
      // compile must carry the flag that drops the unused import.
      await write(
        path.join(head, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { strict: true } }),
      );
      await write(
        path.join(head, "node_modules/pure/package.json"),
        JSON.stringify({ name: "pure", main: "index.js", sideEffects: false }),
      );
      await write(
        path.join(head, "node_modules/pure/index.js"),
        "globalThis.pureRan = true;",
      );
      await packageAt(
        path.join(head, "node_modules/uses-pure"),
        "uses-pure",
        'import "pure";\nexport const used = 1;',
        "index.mjs",
      );
      await write(
        path.join(head, "entry.mjs"),
        'export { used } from "uses-pure";',
      );
      return nativeParams(head);
    },
    check({ result }) {
      assert.doesNotMatch(result.compiled!.code, /pureRan/);
    },
  },
];

for (const row of rows)
  test(`a planned compile matches the full path: ${row.name}`, async (context) => {
    const params = await row.setup(await nativeRoot(context));
    const counted = countedCompile();
    const bundled = await bundle(params, counted.compile);
    await assertFullPathResult(params, bundled.result);
    row.check?.(bundled);
    assert.equal(counted.counts.compilations, 2);
  });

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import type { BundleParams } from "../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { Bundled } from "../packages/mokly/src/sidecar/bundle.js";
import { bundle, bundleWith } from "../packages/mokly/src/sidecar/bundle.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";
import type { PlannedImport } from "../packages/mokly/src/sidecar/native-resolution.js";

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
  /** The consumer plugin's resolver round trips over both compiles. */
  resolves?: number;
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
  ...[{}, { main: "" }].map((main) => ({
    name: `a module-only package keeps its module file for an import: ${JSON.stringify(main)}`,
    async setup(head: string) {
      // Without main fields, esbuild keeps index.js as the fallback of the
      // import and switches to it because cjs-user requires the package.
      await write(
        path.join(head, "node_modules/dual/package.json"),
        JSON.stringify({ name: "dual", module: "esm.js", ...main }),
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
    check({ result }: Bundled) {
      assert.ok(
        result.modules.some(
          (module) => module.path === "node_modules/dual/esm.js",
        ),
      );
    },
  })),
  {
    name: "side-effect flags reach the planned compile",
    // The catalogue's bare import makes one round trip in each compile, so
    // both dependency imports come from the plan.
    resolves: 2,
    async setup(head) {
      // The tsconfig makes the native result inexact. The planned compile
      // must drop the unused import of pure and keep the one of effectful.
      await write(
        path.join(head, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { strict: true } }),
      );
      for (const [name, manifest] of [
        ["pure", { sideEffects: false }],
        ["effectful", {}],
      ] as const) {
        await write(
          path.join(head, `node_modules/${name}/package.json`),
          JSON.stringify({ name, main: "index.js", ...manifest }),
        );
        await write(
          path.join(head, `node_modules/${name}/index.js`),
          `globalThis.${name}Ran = true;`,
        );
      }
      await packageAt(
        path.join(head, "node_modules/uses-pure"),
        "uses-pure",
        'import "pure";\nimport "effectful";\nexport const used = 1;',
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
      assert.match(result.compiled!.code, /effectfulRan/);
    },
  },
];

/** A plan that records each import that the planned compile takes from it. */
class RecordedPlan extends Map<string, PlannedImport> {
  readonly found = new Set<string>();

  override get(key: string): PlannedImport | undefined {
    const planned = super.get(key);
    if (planned) this.found.add(key);
    return planned;
  }
}

/** The planned compile takes every planned import from its plan. */
async function assertPlanUsed(params: BundleParams): Promise<void> {
  const native = await bundleWith(params, build, unmeasured, {
    mode: "native",
  });
  assert.ok(!("generation" in native) && native.plan, "native result stood");
  const plan = new RecordedPlan(native.plan);
  await bundleWith(params, build, unmeasured, { mode: "planned", plan });
  assert.ok(plan.size > 0);
  assert.deepEqual([...plan.found].sort(), [...plan.keys()].sort());
}

for (const row of rows)
  test(`a planned compile matches the full path: ${row.name}`, async (context) => {
    const params = await row.setup(await nativeRoot(context));
    const counted = countedCompile();
    const bundled = await bundle(params, counted.compile);
    await assertFullPathResult(params, bundled.result);
    row.check?.(bundled);
    assert.equal(counted.counts.compilations, 2);
    if (row.resolves !== undefined)
      assert.equal(counted.consumerResolves(), row.resolves);
    await assertPlanUsed(params);
  });

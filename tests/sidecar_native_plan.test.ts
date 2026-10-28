import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

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

test("a dependency with a package type compiles again from the plan with bundler interop", async (context) => {
  const head = await nativeRoot(context);
  // The relative import resolves natively, so esbuild gives impl.js the
  // package type of esm-lib.
  await packageAt(
    path.join(head, "node_modules/esm-lib"),
    "esm-lib",
    'export { default } from "./impl.js";',
    "index.js",
  );
  await write(
    path.join(head, "node_modules/esm-lib/impl.js"),
    'import value from "babel-cjs";\nexport default value;',
  );
  await write(
    path.join(head, "node_modules/esm-lib/package.json"),
    JSON.stringify({ name: "esm-lib", main: "index.js", type: "module" }),
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
  const params = nativeParams(head);
  const counted = countedCompile();
  const { result, generation } = await bundle(params, counted.compile);
  await assertFullPathResult(params, result);
  generation.maps = {};
  // Node's rule for a "type": "module" importer would give the exports object.
  assert.equal(
    evaluate(generation).entries["entry.mjs"]!.default,
    "babel default",
  );
  assert.equal(counted.counts.compilations, 2);
  // The planned compile repeats only the catalogue's bare import.
  assert.equal(counted.consumerResolves(), 2);
});

test("a catalogue under a classic JSX tsconfig keeps the development runtime", async (context) => {
  const head = await nativeRoot(context);
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
  const params = nativeParams(
    head,
    { entryFiles: ["entry.jsx"] },
    { packageRoots: [head, path.resolve(".")] },
  );
  const counted = countedCompile();
  const { result } = await bundle(params, counted.compile);
  await assertFullPathResult(params, result);
  assert.match(result.compiled!.code, /jsxDEV\(/);
  assert.doesNotMatch(result.compiled!.code, /\bh\(/);
  assert.equal(counted.counts.compilations, 2);
});

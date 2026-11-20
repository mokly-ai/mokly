import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle, bundleWith } from "../packages/mokly/src/sidecar/bundle.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";
import { planKey } from "../packages/mokly/src/sidecar/native-resolution.js";

import {
  countedCompile,
  editFingerprint,
  fullPathError,
  moduleNames,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

test("safe planned relative imports remove callbacks as the graph grows and keep edit evidence", async (context) => {
  const root = await nativeRoot(context);
  const observed: number[][] = [];
  for (const size of [3, 12]) {
    const head = path.join(root, String(size));
    const specifiers = Array.from(
      { length: size },
      (_, index) => `./part[${index}]+.mjs`,
    );
    await packageAt(
      path.join(head, "node_modules/chain"),
      "chain",
      specifiers
        .map(
          (name, index) =>
            `export { value as v${index} } from ${JSON.stringify(name)};`,
        )
        .join("\n"),
    );
    for (const [index, specifier] of specifiers.entries())
      await write(
        path.join(head, "node_modules/chain", specifier),
        `export const value = ${index};`,
      );
    await write(path.join(head, "entry.mjs"), 'export * from "chain";');
    await write(
      path.join(head, "tsconfig.json"),
      '{"compilerOptions":{"strict":true}}',
    );
    const params = nativeParams(head);
    const native = await bundleWith(params, build, unmeasured, {
      mode: "native",
    });
    assert.ok(!("generation" in native) && native.plan);
    const counted = countedCompile();
    const planned = await bundle(
      params,
      counted.compile,
      undefined,
      undefined,
      "serveEdit",
      {
        imports: Object.fromEntries(native.plan),
      },
    );
    const full = await bundle(params, build, undefined, undefined, "serveEdit");
    assert.deepEqual(
      editFingerprint(planned.result),
      editFingerprint(full.result),
    );
    assert.equal(planned.result.compiled.reuseEvidence.uncaptured, "serveEdit");
    assert.equal(planned.result.plan, undefined);
    observed.push([
      specifiers.reduce(
        (sum, name) => sum + counted.consumerCallbacks(name),
        0,
      ),
      counted.consumerCallbacks("chain"),
      counted.counts.compilations,
    ]);
  }
  assert.deepEqual(observed, [
    [0, 2, 1],
    [0, 2, 1],
  ]);
});

for (const [name, actual] of [
  ["a different target", 'export const value = "native";'],
  ["a native compile error", 'export const other = "native";'],
] as const)
  test(`a planned relative import retries the complete plan after ${name}`, async (context) => {
    const root = await nativeRoot(context);
    const entry = path.join(root, "entry.mjs");
    await write(entry, 'export { value } from "./value.mjs";');
    const dependency = path.join(root, "dependency.mjs");
    await write(dependency, "export const dependency = 1;");
    await write(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { paths: { [dependency]: [dependency] } },
      }),
    );
    await write(
      path.join(root, "value.mjs"),
      `import ${JSON.stringify(dependency)};\n${actual}`,
    );
    await write(
      path.join(root, "planned.mjs"),
      'export const value = "planned";',
    );
    const plan = {
      imports: {
        [planKey(entry, "./value.mjs", "import-statement")]: {
          path: path.join(root, "planned.mjs"),
          sideEffects: true,
        },
      },
    };
    const counted = countedCompile();
    const planned = await bundle(
      nativeParams(root),
      counted.compile,
      undefined,
      undefined,
      "serveEdit",
      plan,
    );
    assert.deepEqual(moduleNames(planned.result), ["entry.mjs", "planned.mjs"]);
    assert.match(planned.result.compiled.code, /value = "planned"/);
    assert.equal(
      planned.result.compiled.inputs[path.join(root, "value.mjs")],
      undefined,
    );
    assert.equal(planned.result.compiled.inputs[dependency], undefined);
    assert.equal(planned.result.compiled.reuseEvidence.uncaptured, "serveEdit");
    assert.equal(counted.counts.compilations, 2);
    assert.equal(counted.consumerCallbacks("./value.mjs"), 1);
  });

for (const [name, source] of [
  [
    "require.resolve",
    'export const location = require.resolve("./value.mjs");',
  ],
  [
    "handled require",
    'let location; try { location = require("./value.mjs"); } catch {} export { location };',
  ],
] as const)
  test(`a skipped relative ${name} retries before its invisible missing target can publish`, async (context) => {
    const root = await nativeRoot(context);
    const entry = path.join(root, "entry.mjs");
    await write(
      entry,
      'export { value } from "./value.mjs"; export { location } from "./nested/read.mjs";',
    );
    await write(path.join(root, "value.mjs"), 'export const value = "value";');
    await write(path.join(root, "nested/read.mjs"), source);
    const params = nativeParams(root);
    const expected = await fullPathError(params);
    const counted = countedCompile();
    await assert.rejects(
      bundle(params, counted.compile, undefined, undefined, "serveEdit", {
        imports: {
          [planKey(entry, "./value.mjs", "import-statement")]: {
            path: path.join(root, "value.mjs"),
            sideEffects: true,
          },
        },
      }),
      { code: "bundle-failed", message: expected },
    );
    assert.equal(counted.counts.compilations, 2);
    assert.equal(counted.consumerCallbacks("./value.mjs"), 3);
  });

test("new strings keep the full callback and a safe string from a new importer is proved in one compile", async (context) => {
  const root = await nativeRoot(context);
  const entry = path.join(root, "entry.mjs");
  await write(
    entry,
    'export { value } from "./value.mjs"; export { added } from "./nested/new.mjs";',
  );
  await write(path.join(root, "value.mjs"), 'export const value = "value";');
  await write(
    path.join(root, "nested/new.mjs"),
    'export { added } from "./value.mjs";',
  );
  await write(
    path.join(root, "nested/value.mjs"),
    'export const added = "new";',
  );
  const params = nativeParams(root);
  const counted = countedCompile();
  const planned = await bundle(
    params,
    counted.compile,
    undefined,
    undefined,
    "serveEdit",
    {
      imports: {
        [planKey(entry, "./value.mjs", "import-statement")]: {
          path: path.join(root, "value.mjs"),
          sideEffects: true,
        },
      },
    },
  );
  const full = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.deepEqual(
    editFingerprint(planned.result),
    editFingerprint(full.result),
  );
  assert.deepEqual(moduleNames(planned.result), moduleNames(full.result));
  assert.deepEqual(planned.result.compiled.inputs, full.result.compiled.inputs);
  assert.equal(counted.counts.compilations, 1);
  assert.equal(counted.consumerCallbacks("./nested/new.mjs"), 2);
  assert.equal(counted.consumerCallbacks("./value.mjs"), 0);
});

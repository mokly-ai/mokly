import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { planKey } from "../packages/mokly/src/sidecar/native-resolution.js";

import {
  countedCompile,
  fullPathError,
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";

function missFirstAnswer(name: string, innerImporter?: string) {
  const counted = countedCompile();
  const compile: typeof build = (options) => {
    if (counted.counts.compilations === 0)
      for (const plugin of options.plugins ?? []) {
        if (plugin.name !== "mokly-consumer") continue;
        const setup = plugin.setup;
        plugin.setup = (builder) => {
          if (innerImporter)
            builder.onStart(async () => {
              await builder.resolve(name, {
                importer: innerImporter,
                resolveDir: path.dirname(innerImporter),
                kind: "import-statement",
                pluginData: "repository-resolved",
              });
            });
          return setup({
            ...builder,
            onResolve(registration, callback) {
              builder.onResolve(registration, (args) =>
                args.path === name && args.pluginData === undefined
                  ? undefined
                  : callback(args),
              );
            },
          });
        };
      }
    return counted.compile(options);
  };
  return { compile, counts: counted.counts };
}

test("an unanswered unsafe relative edge retries despite a matching plan path and an inner callback", async (context) => {
  const root = await nativeRoot(context);
  const entry = path.join(root, "entry.mjs");
  await write(
    entry,
    'import "./effect.mjs"; export { value } from "./safe.mjs";',
  );
  await write(path.join(root, "safe.mjs"), "export const value = 1;");
  const target = path.join(root, "effect.mjs");
  await write(target, "globalThis.effectRan = true;");
  const counted = missFirstAnswer("./effect.mjs", entry);
  const planned = await bundle(
    nativeParams(root),
    counted.compile,
    undefined,
    undefined,
    "serveEdit",
    {
      imports: {
        [planKey(entry, "./safe.mjs", "import-statement")]: {
          path: path.join(root, "safe.mjs"),
          sideEffects: true,
        },
        [planKey(entry, "./effect.mjs", "import-statement")]: {
          path: target,
          sideEffects: false,
        },
      },
    },
  );
  assert.equal(counted.counts.compilations, 2);
  assert.doesNotMatch(planned.result.compiled.code, /effectRan/);
});

test("an erased relative type import needs no consumer callback ownership", async (context) => {
  const root = await nativeRoot(context);
  const entry = path.join(root, "entry.ts");
  await write(
    entry,
    'import { Shape } from "./types.js"; export const shape: Shape = 1; export { value } from "./safe.mjs";',
  );
  await write(path.join(root, "safe.mjs"), "export const value = 1;");
  const counted = countedCompile();
  const planned = await bundle(
    nativeParams(root, { entryFiles: ["entry.ts"] }),
    counted.compile,
    undefined,
    undefined,
    "serveEdit",
    {
      imports: {
        [planKey(entry, "./safe.mjs", "import-statement")]: {
          path: path.join(root, "safe.mjs"),
          sideEffects: true,
        },
      },
    },
  );
  assert.equal(counted.counts.compilations, 1);
  assert.equal(counted.consumerCallbacks("./types.js"), 0);
  assert.doesNotMatch(planned.result.compiled.code, /types\.js/);
});

for (const [name, source] of [
  [
    "require.resolve",
    'export const location = require.resolve("./missing.mjs");',
  ],
  [
    "handled require",
    'let location; try { location = require("./missing.mjs"); } catch {} export { location };',
  ],
] as const)
  test(`an unanswered unknown relative ${name} retries before its external edge publishes`, async (context) => {
    const root = await nativeRoot(context);
    const entry = path.join(root, "entry.mjs");
    await write(entry, 'export { value } from "./safe.mjs";\n' + source);
    await write(path.join(root, "safe.mjs"), "export const value = 1;");
    const params = nativeParams(root);
    const expected = await fullPathError(params);
    const counted = missFirstAnswer("./missing.mjs");
    await assert.rejects(
      bundle(params, counted.compile, undefined, undefined, "serveEdit", {
        imports: {
          [planKey(entry, "./safe.mjs", "import-statement")]: {
            path: path.join(root, "safe.mjs"),
            sideEffects: true,
          },
        },
      }),
      { code: "bundle-failed", message: expected },
    );
    assert.equal(counted.counts.compilations, 2);
  });

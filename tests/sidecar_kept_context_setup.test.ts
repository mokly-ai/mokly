import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { build } from "esbuild";
import type { Plugin } from "esbuild";

import { carries, countedKept } from "./helpers/kept_context.js";
import { nativeRoot, write } from "./helpers/native_resolution.js";

/**
 * Compile `entry.mjs` with `source` once for each label, through one kept
 * context and through a fresh build, so that each test compares the two.
 */
async function outcomes(
  context: TestContext,
  source: string,
  plugin: (label: string, root: string) => Plugin,
  labels: readonly string[],
) {
  const root = await nativeRoot(context);
  const entry = path.join(root, "entry.mjs");
  await write(entry, source);
  const { kept, counts } = countedKept();
  context.after(() => kept.dispose());
  const viaKept: typeof build = (options) => kept.compile(options);
  const result = {
    kept: [] as (boolean | "failed")[],
    fresh: [] as (boolean | "failed")[],
  };
  for (const label of labels) {
    result.kept.push(await carries(viaKept, entry, plugin(label, root), label));
    result.fresh.push(await carries(build, entry, plugin(label, root), label));
  }
  return { ...result, ...counts };
}

test("a build option that a setup assigns reaches the kept context", async (context) => {
  // The setup assigns `define`, as a fresh build allows; the compile options never name it.
  const plugin = (label: string): Plugin => ({
    name: "label",
    setup(builder) {
      builder.initialOptions.define = { LABEL: JSON.stringify(label) };
    },
  });
  assert.deepEqual(
    await outcomes(context, "export const value = LABEL;", plugin, [
      "first",
      "second",
      "second",
    ]),
    {
      kept: [true, true, true],
      fresh: [true, true, true],
      created: 2,
      disposed: 1,
    },
  );
});

test("a plugin that a setup adds to the plugin list stays out of the kept context", async (context) => {
  // The added plugin would resolve the import; a fresh build sets up a copy of the list, so it never runs.
  const values = (label: string): Plugin => ({
    name: "values",
    setup(builder) {
      builder.onResolve({ filter: /^virtual:value$/ }, (args) => ({
        path: args.path,
        namespace: "values",
      }));
      builder.onLoad({ filter: /.*/, namespace: "values" }, () => ({
        contents: `export const value = ${JSON.stringify(label)};`,
        loader: "js",
      }));
    },
  });
  const plugin = (label: string): Plugin => ({
    name: "adds",
    setup(builder) {
      builder.initialOptions.plugins?.push(values(label));
    },
  });
  assert.deepEqual(
    await outcomes(context, 'export { value } from "virtual:value";', plugin, [
      "first",
    ]),
    { kept: ["failed"], fresh: ["failed"], created: 1, disposed: 1 },
  );
});

test("a setup that calls resolve fails, and the failed compile disposes of the kept context", async (context) => {
  // The first compile creates the context; the second calls `resolve` before its setup has ended.
  const plugin = (label: string, root: string): Plugin => ({
    name: "label",
    async setup(builder) {
      if (label === "second")
        await builder.resolve("./entry.mjs", {
          kind: "entry-point",
          resolveDir: root,
        });
      builder.initialOptions.define = { LABEL: JSON.stringify(label) };
    },
  });
  assert.deepEqual(
    await outcomes(context, "export const value = LABEL;", plugin, [
      "first",
      "second",
    ]),
    {
      kept: [true, "failed"],
      fresh: [true, "failed"],
      created: 1,
      disposed: 1,
    },
  );
});

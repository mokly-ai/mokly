import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import { specifierFilter } from "../packages/mokly/src/sidecar/specifier-filter.js";

test("the bounded filter caches one safe-string set and keeps unknown prefixes and suffixes", async () => {
  const names = [
    ".",
    "..",
    "./value",
    "./value.mjs",
    "../tail?[]()+^$|{}\\x",
    "./雪😀.mjs",
  ];
  const omitted = "./" + "long".repeat(1000);
  const { filter, skipped } = specifierFilter([...names, omitted]);
  const repeated = specifierFilter([omitted, ...names.toReversed()]);
  assert.equal(repeated.filter, filter);
  assert.equal(repeated.skipped, skipped);
  const updated = specifierFilter([...names, "./added.mjs", omitted]);
  assert.notEqual(specifierFilter([...names, omitted]).filter, filter);
  const unknown = [
    "",
    "./",
    "../",
    "./value\n",
    "./value.mjs/child",
    ".value",
    "node:path",
    "./雪😃.mjs",
    "\n",
    omitted,
  ];
  for (const row of [
    { filter, accepted: names },
    { filter: updated.filter, accepted: [...names, "./added.mjs"] },
  ]) {
    const callbacks: string[] = [];
    await build({
      stdin: {
        contents: [...row.accepted, ...unknown]
          .map((name) => `import ${JSON.stringify(name)};`)
          .join("\n"),
      },
      bundle: true,
      write: false,
      logLevel: "silent",
      plugins: [
        {
          name: "filtered-specifiers",
          setup(builder) {
            builder.onResolve({ filter: row.filter }, (args) => {
              callbacks.push(args.path);
              return { path: args.path || "empty", external: true };
            });
            builder.onResolve({ filter: /.*/ }, (args) => ({
              path: args.path || "empty",
              external: true,
            }));
          },
        },
      ],
    });
    assert.deepEqual(callbacks.sort(), unknown.toSorted());
  }
  for (const name of names) assert.equal(skipped.has(name), true, name);
  assert.equal(skipped.has(omitted), false);
});

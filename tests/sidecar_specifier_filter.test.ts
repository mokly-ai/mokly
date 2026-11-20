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
    ...Array.from(
      { length: 512 },
      (_, index) => `./group-${index.toString(16)}/value-${index * 37}.mjs`,
    ),
  ];
  const omitted = [
    "./" + "long".repeat(1000),
    "./line\u2028.mjs",
    "./line\u2029.mjs",
  ];
  const { filters, skipped } = specifierFilter([...names, ...omitted]);
  const repeated = specifierFilter([...omitted, ...names.toReversed()]);
  assert.equal(repeated.filters, filters);
  assert.equal(repeated.skipped, skipped);
  assert.ok(filters.length > 1);
  for (const filter of filters)
    assert.ok(Buffer.byteLength(filter.source) <= 32_768);
  assert.ok(
    filters.reduce(
      (sum, filter) => sum + Buffer.byteLength(filter.source),
      0,
    ) <= 1_048_576,
  );
  const updated = specifierFilter([...names, "./added.mjs", ...omitted]);
  assert.notEqual(specifierFilter([...names, ...omitted]).filters, filters);
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
    ...omitted,
  ];
  for (const row of [
    { filters, accepted: names },
    { filters: updated.filters, accepted: [...names, "./added.mjs"] },
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
            for (const filter of row.filters)
              builder.onResolve({ filter }, (args) => {
                callbacks.push(args.path);
                return undefined;
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
  for (const name of omitted) assert.equal(skipped.has(name), false);
});

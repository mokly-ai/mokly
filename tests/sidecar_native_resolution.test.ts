import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";

import {
  assertFullPathResult,
  countedCompile,
  link,
  moduleNames,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

test("dependency imports need no resolver round trip at one and four times the size", async (context) => {
  const root = await nativeRoot(context);
  const observed: number[][] = [];
  for (const size of [3, 12]) {
    const head = path.join(root, String(size));
    const indexes = Array.from({ length: size }, (_, index) => index);
    await packageAt(
      path.join(head, "node_modules/chain"),
      "chain",
      indexes
        .map(
          (index) =>
            `export { value as v${index} } from "./part-${index}.mjs";`,
        )
        .join("\n"),
    );
    for (const index of indexes) {
      await write(
        path.join(head, `node_modules/chain/part-${index}.mjs`),
        `export { value } from "leaf-${index}";`,
      );
      await packageAt(
        path.join(head, `node_modules/leaf-${index}`),
        `leaf-${index}`,
        `export const value = ${index};`,
      );
    }
    await write(path.join(head, "entry.mjs"), 'export * from "chain";');
    const params = nativeParams(head);
    const counted = countedCompile();
    const { result } = await bundle(params, counted.compile);
    await assertFullPathResult(params, result);
    assert.deepEqual(
      moduleNames(result),
      [
        "entry.mjs",
        "node_modules/chain/index.mjs",
        ...indexes.map((index) => `node_modules/chain/part-${index}.mjs`),
        ...indexes.map((index) => `node_modules/leaf-${index}/index.mjs`),
      ].sort(),
    );
    observed.push([counted.consumerResolves(), counted.counts.compilations]);
  }
  // The catalogue's one bare import keeps its round trip at both sizes.
  assert.deepEqual(observed, [
    [1, 1],
    [1, 1],
  ]);
});

test("nested node_modules modules keep their names and unmapped directories", async (context) => {
  const head = await nativeRoot(context);
  await packageAt(
    path.join(head, "node_modules/wrapper"),
    "wrapper",
    'export { inner } from "inner";',
  );
  await packageAt(
    path.join(head, "node_modules/wrapper/node_modules/inner"),
    "inner",
    "export const inner = 'inner';",
  );
  const nested = path.join(head, "packages/ui/node_modules");
  await packageAt(
    path.join(nested, "local"),
    "local",
    'export { member } from "member";\nexport { part } from "./part.mjs";',
  );
  await write(
    path.join(nested, "local/part.mjs"),
    "export const part = 'part';",
  );
  await packageAt(
    path.join(nested, "member"),
    "member",
    "export const member = 'member';",
  );
  await write(
    path.join(head, "packages/ui/src/entry.mjs"),
    'export { inner } from "wrapper";\nexport { member, part } from "../node_modules/local/index.mjs";',
  );
  const params = nativeParams(head, {
    entryFiles: ["packages/ui/src/entry.mjs"],
  });
  const counted = countedCompile();
  const { result } = await bundle(params, counted.compile);
  await assertFullPathResult(params, result);
  assert.deepEqual(moduleNames(result), [
    "node_modules/wrapper/index.mjs",
    "node_modules/wrapper/node_modules/inner/index.mjs",
    "packages/ui/node_modules/local/index.mjs",
    "packages/ui/node_modules/local/part.mjs",
    "packages/ui/node_modules/member/index.mjs",
    "packages/ui/src/entry.mjs",
  ]);
  // Only a relative import reaches the nested installation, so the module
  // classification after the compile records it.
  assert.deepEqual(result.unmappedDependencyDirectories, [
    "packages/ui/node_modules",
  ]);
  assert.equal(counted.consumerResolves(), 1);
  assert.equal(counted.counts.compilations, 1);
});

test("pnpm store links stay on the native path", async (context) => {
  const head = await nativeRoot(context);
  const store = path.join(head, "node_modules/.pnpm");
  const a = path.join(store, "a@1.0.0/node_modules/a");
  const b = path.join(store, "b@1.0.0/node_modules/b");
  await packageAt(
    a,
    "a",
    'export { b } from "b";\nexport { lib } from "./lib.mjs";',
  );
  await write(path.join(a, "lib.mjs"), "export const lib = 'lib';");
  await packageAt(b, "b", "export const b = 'b';");
  await link(b, path.join(store, "a@1.0.0/node_modules/b"));
  await link(a, path.join(head, "node_modules/a"));
  await write(path.join(head, "entry.mjs"), 'export { b, lib } from "a";');
  const params = nativeParams(head);
  const counted = countedCompile();
  const { result } = await bundle(params, counted.compile);
  await assertFullPathResult(params, result);
  assert.deepEqual(moduleNames(result), [
    "entry.mjs",
    "node_modules/.pnpm/a@1.0.0/node_modules/a/index.mjs",
    "node_modules/.pnpm/a@1.0.0/node_modules/a/lib.mjs",
    "node_modules/.pnpm/b@1.0.0/node_modules/b/index.mjs",
  ]);
  assert.deepEqual(result.unmappedDependencyDirectories, []);
  assert.equal(counted.consumerResolves(), 1);
  assert.equal(counted.counts.compilations, 1);
});

test("a dependency resolves a linked workspace package natively on the head side", async (context) => {
  const head = await nativeRoot(context);
  await packageAt(
    path.join(head, "packages/theme"),
    "@app/theme",
    "export const theme = 'head';",
  );
  await link(
    path.join(head, "packages/theme"),
    path.join(head, "node_modules/@app/theme"),
  );
  await packageAt(
    path.join(head, "node_modules/lib"),
    "lib",
    'export { theme } from "@app/theme";',
  );
  await write(path.join(head, "entry.mjs"), 'export { theme } from "lib";');
  const params = nativeParams(head);
  const counted = countedCompile();
  const { result } = await bundle(params, counted.compile);
  await assertFullPathResult(params, result);
  assert.deepEqual(moduleNames(result), [
    "entry.mjs",
    "node_modules/lib/index.mjs",
    "packages/theme/index.mjs",
  ]);
  assert.equal(counted.consumerResolves(), 1);
  assert.equal(counted.counts.compilations, 1);
});

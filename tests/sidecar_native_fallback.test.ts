import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";

import {
  assertFullPathResult,
  countedCompile,
  fullPathError,
  link,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");

function sides(root: string) {
  return { head: path.join(root, "head"), base: path.join(root, "base") };
}

test("a base dependency maps a linked workspace package to the base copy", async (context) => {
  const { head, base } = sides(await nativeRoot(context));
  for (const [side, value] of [
    [head, "head"],
    [base, "base"],
  ] as const)
    await packageAt(
      path.join(side, "packages/theme"),
      "@app/theme",
      `export const theme = '${value}';`,
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
  await write(path.join(base, "entry.mjs"), 'export { theme } from "lib";');
  const params = nativeParams(
    base,
    { repositoryRoots: [head] },
    { dependencyRoot: head, packageRoots: [head] },
  );
  const counted = countedCompile();
  const { result } = await bundle(params, counted.compile);
  await assertFullPathResult(params, result);
  assert.equal(
    result.modules.find((module) => module.path === "packages/theme/index.mjs")
      ?.digest,
    digest("export const theme = 'base';"),
  );
  // The native module is the head copy, so the full path compiles again.
  assert.equal(counted.counts.compilations, 2);
});

test("a base dependency reads a tracked node_modules copy from the base commit", async (context) => {
  const { head, base } = sides(await nativeRoot(context));
  for (const [side, value] of [
    [head, "head"],
    [base, "base"],
  ] as const)
    await packageAt(
      path.join(side, "node_modules/tracked"),
      "tracked",
      `export const value = '${value}';`,
    );
  await packageAt(
    path.join(head, "node_modules/lib"),
    "lib",
    'export { value } from "tracked";',
  );
  await write(path.join(base, "entry.mjs"), 'export { value } from "lib";');
  const params = nativeParams(
    base,
    { repositoryRoots: [head] },
    { dependencyRoot: head, packageRoots: [head] },
  );
  const counted = countedCompile();
  const { result } = await bundle(params, counted.compile);
  await assertFullPathResult(params, result);
  assert.equal(
    result.modules.find(
      (module) => module.path === "node_modules/tracked/index.mjs",
    )?.digest,
    digest("export const value = 'base';"),
  );
  assert.deepEqual(result.unmappedDependencyDirectories, ["node_modules"]);
  assert.equal(counted.counts.compilations, 2);
});

for (const [name, file, source, message] of [
  [
    "an escaping import from a dependency",
    "index.mjs",
    'export { x } from "../../../outside.mjs";',
    /^node_modules\/dep\/index\.mjs:1:19: module outside\.mjs is outside sourceRoot and selected dependency roots$/,
  ],
  [
    "a require.resolve of an escaping path",
    "index.cjs",
    'module.exports = require.resolve("../../../outside.mjs");',
    /^node_modules\/dep\/index\.cjs:1:34: module outside\.mjs is outside sourceRoot and selected dependency roots$/,
  ],
  [
    "a handled require failure",
    "index.cjs",
    'let value = 1;\ntry { value = require("not-installed"); } catch {}\nmodule.exports = value;',
    /^node_modules\/dep\/index\.cjs:2:23: Could not resolve "not-installed"\n/,
  ],
] as const)
  test(`${name} fails at its importer with the full-path diagnostic`, async (context) => {
    const root = await nativeRoot(context);
    const head = path.join(root, "head");
    await write(path.join(root, "outside.mjs"), "export const x = 1;");
    await packageAt(path.join(head, "node_modules/dep"), "dep", source, file);
    await write(path.join(head, "entry.mjs"), 'export * from "dep";');
    const params = nativeParams(head);
    const expected = await fullPathError(params);
    assert.match(expected, message);
    const counted = countedCompile();
    await assert.rejects(bundle(params, counted.compile), {
      code: "bundle-failed",
      message: expected,
    });
    assert.equal(counted.counts.compilations, 2);
  });

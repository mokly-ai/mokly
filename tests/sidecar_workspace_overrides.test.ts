import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import { restore } from "../packages/mokly/src/sidecar/compiled.js";

import {
  link,
  moduleNames,
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";
import { startSidecar } from "./helpers/sidecar.js";

const name = "@example/ui";
const pkg = "packages/local";
const working = { [name]: { esm: "source" } };

async function workspaceSides(
  context: TestContext,
  exports: string | Record<string, string>,
  entry: string,
) {
  const root = await nativeRoot(context);
  const head = path.join(root, "head");
  const base = path.join(root, "base");
  for (const side of [head, base]) {
    await write(path.join(side, "entry.mjs"), entry);
    await write(
      path.join(side, pkg, "package.json"),
      JSON.stringify({ name, exports }),
    );
  }
  await link(path.join(head, pkg), path.join(head, "node_modules/local"));
  return { head, base };
}

test("workspace layouts select JavaScript and CSS per file on the head and base", async (context) => {
  const { head, base } = await workspaceSides(
    context,
    { ".": "./esm/value.js", "./theme.css": "./esm/theme.css" },
    'export {value} from "local"; import "local/theme.css";',
  );
  await write(
    path.join(head, pkg, "release/value.js"),
    'export const value = "Built";',
  );
  await write(path.join(head, pkg, "release/theme.css"), ".built {}\n");
  await link(path.join(head, pkg, "release"), path.join(head, pkg, "esm"));
  await write(
    path.join(head, pkg, "source/value.ts"),
    'export const value = "Head";',
  );
  await write(
    path.join(base, pkg, "source/value.ts"),
    'export const value = "Working layout on base";',
  );
  await write(
    path.join(base, pkg, "historical/value.ts"),
    'export const value = "Base";',
  );
  for (const side of [head, base])
    await write(path.join(side, pkg, "source/theme.css"), ".source {}\n");

  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const current = await sidecar.call<BundleResult>(
    "bundle",
    nativeParams(head, {}, { sourcePackages: [working] }),
  );
  assert.deepEqual(moduleNames(current).sort(), [
    "entry.mjs",
    "packages/local/source/theme.css",
    "packages/local/source/value.ts",
  ]);
  assert.match(current.compiled.code, /value = "Head"/);

  const historical = await sidecar.call<BundleResult>(
    "bundle",
    nativeParams(
      base,
      { repositoryRoots: [head] },
      {
        packageRoots: [head],
        sourcePackages: [{ [name]: { esm: "historical" } }, working],
      },
    ),
  );
  assert.deepEqual(moduleNames(historical).sort(), [
    "entry.mjs",
    "packages/local/historical/value.ts",
    "packages/local/source/theme.css",
  ]);
  assert.match(historical.compiled.code, /value = "Base"/);
  for (const file of [
    "esm/value.js",
    "esm/theme.css",
    "historical/theme.css",
  ]) {
    assert.equal(historical.compiled.metadataInputs[`${pkg}/${file}`], null);
    assert.equal(
      historical.compiled.reuseEvidence.inputs[path.join(base, pkg, file)]
        ?.kind,
      "absent",
      file,
    );
  }
  await sidecar.call("shutdown");
});

test("a missing workspace build recovers only when export targets agree through the layout order", async (context) => {
  const root = await nativeRoot(context);
  const directory = path.join(root, pkg);
  await write(
    path.join(directory, "package.json"),
    JSON.stringify({
      name,
      exports: { import: "./esm/value.js", require: "./cjs/value.cjs" },
    }),
  );
  await write(
    path.join(directory, "source/value.ts"),
    'export const value = "Source";',
  );
  await write(
    path.join(directory, "other/value.ts"),
    'export const value = "Other";',
  );
  await write(path.join(root, "entry.mjs"), 'export {value} from "local";');
  await link(directory, path.join(root, "node_modules/local"));

  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  await assert.rejects(
    sidecar.call(
      "bundle",
      nativeParams(
        root,
        {},
        {
          sourcePackages: [working, { [name]: { cjs: "other" } }],
        },
      ),
    ),
    { code: "bundle-failed", message: /Could not resolve "local"/ },
  );

  const result = await sidecar.call<BundleResult>(
    "bundle",
    nativeParams(
      root,
      {},
      {
        sourcePackages: [working, { [name]: { cjs: "source" } }],
      },
    ),
  );
  assert.deepEqual(moduleNames(result).sort(), [
    "entry.mjs",
    "packages/local/source/value.ts",
  ]);
  assert.equal(
    result.compiled.metadataInputs["packages/local/esm/value.js"],
    null,
  );
  assert.equal(
    result.compiled.metadataInputs["packages/local/cjs/value.cjs"],
    null,
  );
  await sidecar.call("shutdown");
});

test("restored requires retain the head build and use workspace layouts for missing base builds", async (context) => {
  const { head, base } = await workspaceSides(
    context,
    { ".": "./esm/value.cjs", "./unbuilt": "./esm/unbuilt.cjs" },
    'export const value = "Entry";',
  );
  await write(
    path.join(head, pkg, "esm/value.cjs"),
    'module.exports = "Built";',
  );
  for (const side of [head, base])
    await write(
      path.join(side, pkg, "source/value.cjs"),
      'module.exports = "Source";',
    );
  await write(
    path.join(base, pkg, "source/unbuilt.cjs"),
    'module.exports = "Recovered";',
  );

  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const extensions = { resolveExtensions: [".cjs"] };
  const headParams = nativeParams(
    head,
    {},
    { ...extensions, sourcePackages: [working] },
  );
  const baseParams = nativeParams(
    base,
    { repositoryRoots: [head] },
    {
      ...extensions,
      dependencyRoot: head,
      packageRoots: [head],
      sourcePackages: [{ [name]: { esm: "missing" } }, working],
    },
  );
  for (const [params, imports] of [
    [headParams, [["local", "esm/value.cjs", "Built"]]],
    [
      baseParams,
      [
        ["local", "source/value.cjs", "Source"],
        ["local/unbuilt", "source/unbuilt.cjs", "Recovered"],
      ],
    ],
  ] as const) {
    const result = await sidecar.call<BundleResult>("bundle", params);
    const runtime = restore(params, result.compiled, result.modules).require;
    for (const [specifier, file, value] of imports) {
      assert.equal(
        runtime.resolve(specifier),
        path.join(params.sourceRoot, pkg, file),
      );
      assert.equal(runtime(specifier), value);
    }
  }
  await sidecar.call("shutdown");
});

test("a base entry of false keeps its build when the working entry and detection have sources", async (context) => {
  const { head, base } = await workspaceSides(
    context,
    "./dist/value.js",
    'export {value} from "local";',
  );
  for (const [side, value] of [
    [head, "Head"],
    [base, "Base"],
  ] as const) {
    await write(
      path.join(side, pkg, "dist/value.js"),
      `export const value = "Built ${value}";`,
    );
    await write(
      path.join(side, pkg, "source/value.ts"),
      'export const value = "Override";',
    );
    await write(
      path.join(side, pkg, "src/value.ts"),
      'export const value = "Detected";',
    );
  }
  const override = { [name]: { dist: "source" } };
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<BundleResult>(
    "bundle",
    nativeParams(
      base,
      { repositoryRoots: [head] },
      {
        packageRoots: [head],
        sourcePackages: [{ [name]: false }, override],
      },
    ),
  );
  assert.deepEqual(moduleNames(result).sort(), [
    "entry.mjs",
    "packages/local/dist/value.js",
  ]);
  assert.match(result.compiled.code, /value = "Built Base"/);
  await sidecar.call("shutdown");
});

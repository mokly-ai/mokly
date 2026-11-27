import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import { restore } from "../packages/mokly/src/sidecar/compiled.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import {
  link,
  moduleNames,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";
import { startSidecar } from "./helpers/sidecar.js";

const name = "workspace-local";
const pkg = "packages/local";

async function sides(context: TestContext) {
  const root = await nativeRoot(context);
  const head = path.join(root, "head");
  const base = path.join(root, "base");
  await link(path.join(head, pkg), path.join(head, "node_modules", name));
  return { head, base };
}

for (const workingBuild of [true, false]) {
  test(`a base bundle uses its own export conditions with the working build ${workingBuild ? "present" : "absent"}`, async (context) => {
    const { head, base } = await sides(context);
    const specifier = workingBuild ? "entry-wrapper" : "aliased-local";
    await write(
      path.join(head, pkg, "package.json"),
      JSON.stringify({ name, exports: "./new-build/value.js" }),
    );
    await write(
      path.join(base, pkg, "package.json"),
      JSON.stringify({
        name,
        exports: {
          historical: "./old-build/value.js",
          default: "./other/value.js",
        },
      }),
    );
    if (workingBuild) {
      await write(
        path.join(head, pkg, "new-build/value.js"),
        'export const value = "Working";',
      );
      await packageAt(
        path.join(head, "node_modules", specifier),
        specifier,
        `export {value} from "${name}";`,
      );
    }
    await write(
      path.join(base, pkg, "old-build/value.js"),
      'export const value = "Base build";',
    );
    await write(
      path.join(base, pkg, "source/value.ts"),
      'export const value = "Base source";',
    );
    await write(
      path.join(base, "entry.mjs"),
      `export {value} from "${specifier}";`,
    );

    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    const result = await sidecar.call<BundleResult>(
      "bundle",
      nativeParams(
        base,
        { repositoryRoots: [head] },
        {
          dependencyRoot: head,
          packageRoots: [head],
          conditions: ["historical"],
          aliases: workingBuild
            ? {}
            : { [specifier]: name, [name]: "different-package" },
          sourcePackages: [{ [name]: { "old-build": "source" } }],
        },
      ),
    );
    assert.deepEqual(moduleNames(result).sort(), [
      "entry.mjs",
      ...(workingBuild ? ["node_modules/entry-wrapper/index.mjs"] : []),
      `${pkg}/source/value.ts`,
    ]);
    assert.match(result.compiled.code, /value = "Base source"/);
    for (const [file, kind] of [
      ["package.json", "file"],
      ["old-build/value.js", "filePath"],
    ] as const)
      assert.equal(
        result.compiled.reuseEvidence.inputs[path.join(base, pkg, file)]?.kind,
        kind,
        file,
      );
    await sidecar.call("shutdown");
  });
}

async function baseBuild(context: TestContext, entry: string) {
  const { head, base } = await sides(context);
  for (const side of [head, base])
    await write(
      path.join(side, pkg, "package.json"),
      JSON.stringify({ name, main: "./dist/value.cjs" }),
    );
  await write(
    path.join(base, pkg, "dist/value.cjs"),
    'module.exports = "Base build";',
  );
  await write(
    path.join(base, pkg, "src/value.cjs"),
    'module.exports = "Base source";',
  );
  await write(path.join(base, "entry.mjs"), entry);
  return nativeParams(
    base,
    { repositoryRoots: [head] },
    {
      dependencyRoot: head,
      packageRoots: [head],
      resolveExtensions: [".cjs"],
      sourcePackages: [{ [name]: false }, { [name]: { dist: "src" } }],
    },
  );
}

test("a base entry of false bundles a base-only build", async (context) => {
  const params = await baseBuild(
    context,
    `export const value = require("${name}");`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<BundleResult>("bundle", params);
  assert.deepEqual(moduleNames(result).sort(), [
    "entry.mjs",
    `${pkg}/dist/value.cjs`,
  ]);
  const output = evaluate(restore(params, result.compiled, result.modules));
  assert.equal(output.entries["entry.mjs"]?.value, "Base build");
  await sidecar.call("shutdown");
});

test("a base entry of false keeps a base-only build for a restored require", async (context) => {
  const params = await baseBuild(context, 'export const value = "Entry";');
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<BundleResult>("bundle", params);
  const runtime = restore(params, result.compiled, result.modules).require;
  assert.equal(
    runtime.resolve(name),
    path.join(params.sourceRoot, pkg, "dist/value.cjs"),
  );
  assert.equal(runtime(name), "Base build");
  await sidecar.call("shutdown");
});

for (const [scenario, target, relative, disabled] of [
  ["a root export", "value.js", false, false],
  ["a relative import", "esm/value.js", true, false],
  ["an export after a false layout", "esm/value.js", false, true],
] as const) {
  test(`a missing base file reached through ${scenario} reports the missing path`, async (context) => {
    const { head, base } = await sides(context);
    for (const side of [head, base])
      await write(
        path.join(side, pkg, "package.json"),
        JSON.stringify({ name, exports: `./${target}` }),
      );
    await write(path.join(head, pkg, target), 'export const value = "Head";');
    const specifier = relative ? `../head/${pkg}/${target}` : name;
    await write(
      path.join(base, "entry.mjs"),
      `export {value} from "${specifier}";`,
    );
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    await assert.rejects(
      sidecar.call(
        "bundle",
        nativeParams(
          base,
          { repositoryRoots: [head] },
          {
            dependencyRoot: head,
            packageRoots: [head],
            sourcePackages: disabled
              ? [{ [name]: { esm: "missing" } }, { [name]: false }]
              : [],
          },
        ),
      ),
      {
        code: "bundle-failed",
        message: `entry.mjs:1:21: module ${pkg}/${target} has no source in this side`,
      },
    );
    await sidecar.call("shutdown");
  });
}

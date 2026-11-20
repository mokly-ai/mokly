import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { write } from "./helpers/native_resolution.js";
import { folderPackage } from "./helpers/package_folder.js";

function state(location: string, owner = "./"): string {
  return JSON.stringify({
    packageRegistryData: [
      [
        null,
        [
          [
            null,
            {
              packageLocation: owner,
              packageDependencies: [["chosen", "workspace:chosen"]],
            },
          ],
        ],
      ],
      [
        "chosen",
        [
          [
            "workspace:chosen",
            { packageLocation: location, packageDependencies: [] },
          ],
        ],
      ],
    ],
  });
}

for (const previous of ["none", "embedded", "ancestor"] as const)
  for (const capture of ["full", "serveEdit"] as const)
    test(`${capture} folder reuse rejects new PnP data after ${previous} with nested entries only`, async (context) => {
      const fixture = await folderPackage(context, {
        name: previous,
        route: "installed",
      });
      const { root, params } = fixture;
      params.entryFiles = ["entries/entry.mjs"];
      await fs.mkdir(path.join(root, "entries"));
      await fs.rename(
        path.join(root, "entry.mjs"),
        path.join(root, "entries/entry.mjs"),
      );
      await write(
        path.join(root, ".yarn/preferred/package.json"),
        '{"name":"chosen","exports":{"./sub/":"./lib/"}}',
      );
      await write(
        path.join(root, ".yarn/preferred/lib/value.ts"),
        'export const value="preferred-file";',
      );
      if (previous === "embedded")
        await write(
          path.join(root, ".pnp.cjs"),
          `hydrateRuntimeState(JSON.parse(${JSON.stringify(state("./node_modules/chosen/"))}));`,
        );
      const first = await bundle(params, build, undefined, undefined, capture);
      assert.equal(
        Object.hasOwn(first.result.compiled.inputDirectories, root),
        false,
      );
      assert.match(first.result.compiled.code, /original-index/);
      await fixture.unrelated();
      assert.equal(
        (await reuse([first.generation], params, capture))?.runtimeKey,
        first.result.compiled.runtimeKey,
      );
      await write(
        path.join(
          previous === "ancestor" ? path.dirname(root) : root,
          ".pnp.data.json",
        ),
        previous === "ancestor"
          ? state("./catalogue/.yarn/preferred/", "./catalogue/")
          : state("./.yarn/preferred/"),
      );
      const native = await bundle(params, build, undefined, undefined, capture);
      assert.match(native.result.compiled.code, /preferred-file/);
      assert.equal(
        (await reuse([first.generation], params, capture))?.runtimeKey,
        undefined,
      );
    });

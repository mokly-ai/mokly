import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { bundleParams, cssParams, startSidecar } from "./helpers/sidecar.js";
import { dependency, sidecarSources } from "./helpers/sidecar_sources.js";

for (const layout of [
  "outside-configuration",
  "nested-package",
  "linked-store",
]) {
  test(`records actual unmapped dependencies: ${layout}`, async (context) => {
    const { head } = await sidecarSources(context);
    await fs.mkdir(path.join(head, "apps/web"), { recursive: true });
    await fs.mkdir(path.join(head, "packages/ui/src"), { recursive: true });
    await dependency(head, "fixture-version", "export default 'root-v1';");
    if (layout === "outside-configuration")
      await dependency(
        path.join(head, "apps/web"),
        "fixture-version",
        "export default 'app-v2';",
      );
    else if (layout === "nested-package")
      await dependency(
        path.join(head, "packages/ui"),
        "fixture-version",
        "export default 'member-v2';",
      );
    else {
      const store = await dependency(
        path.join(head, "node_modules/.pnpm/store"),
        "fixture-version",
        "export default 'store-v2';",
      );
      await fs.mkdir(path.join(head, "packages/ui/node_modules"), {
        recursive: true,
      });
      await fs.symlink(
        store,
        path.join(head, "packages/ui/node_modules/fixture-version"),
        "junction",
      );
    }
    await fs.writeFile(
      path.join(head, "packages/ui/src/entry.ts"),
      "import value from 'fixture-version'; export default value;",
    );
    const settings = bundleParams().moduleResolution;
    settings.packageRoots =
      layout === "outside-configuration"
        ? [path.join(head, "apps/web"), path.join(head, "apps"), head]
        : [head];
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    const result = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        sourceRoot: head,
        storiesFiles: [],
        renderer: null,
        configurationDirectory:
          layout === "outside-configuration" ? "apps/web" : ".",
        entryFiles: ["packages/ui/src/entry.ts"],
        moduleResolution: settings,
      }),
    );
    assert.deepEqual(result.unmappedDependencyDirectories, [
      layout === "outside-configuration"
        ? "node_modules"
        : "packages/ui/node_modules",
    ]);
    await sidecar.call("shutdown");
  });
}

test("unused nested directories do not report dependency usage", async (context) => {
  const { head } = await sidecarSources(context);
  await dependency(
    path.join(head, "packages/unused"),
    "fixture-version",
    "export default 1;",
  );
  await dependency(head, "fixture-root", "export default 'root';");
  await fs.writeFile(
    path.join(head, "entry.ts"),
    "import value from 'fixture-root'; export default value;",
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: head,
      storiesFiles: [],
      renderer: null,
      entryFiles: ["entry.ts"],
      moduleResolution: {
        ...bundleParams().moduleResolution,
        packageRoots: [head],
      },
    }),
  );
  assert.ok(
    result.modules.some(
      (module) => module.path === "node_modules/fixture-root/index.mjs",
    ),
  );
  assert.deepEqual(result.unmappedDependencyDirectories, []);
  await sidecar.call("shutdown");
});

for (const form of ["import", "require"]) {
  test(`PostCSS records unmapped package ${form} lookups`, async (context) => {
    const { head } = await sidecarSources(context);
    await dependency(
      path.join(head, "packages/ui"),
      "fixture-plugin",
      "module.exports=()=>({postcssPlugin:'fixture',Once(root){root.append({selector:'.hit',nodes:[{prop:'color',value:'red'}]});}});",
      "cjs",
    );
    await fs.writeFile(
      path.join(head, "packages/ui/postcss.mjs"),
      `${form === "import" ? "import plugin from 'fixture-plugin';" : "const plugin=require('fixture-plugin');"} export default {plugins:[plugin()]};`,
    );
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    const result = await sidecar.call<CssResult>(
      "processCss",
      cssParams({
        sourceRoot: head,
        postcss: "packages/ui/postcss.mjs",
        moduleResolution: {
          ...bundleParams().moduleResolution,
          packageRoots: [head],
        },
      }),
    );
    assert.match(result.text, /color: red/);
    assert.deepEqual(result.unmappedDependencyDirectories, [
      "packages/ui/node_modules",
    ]);
    await sidecar.call("shutdown");
  });
}

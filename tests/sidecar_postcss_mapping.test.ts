import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { bundleParams, cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

for (const layout of ["npm", "pnpm"])
  test(`${layout} PostCSS workspace presets use base sources for each resolution form`, async (context) => {
    const { head, base } = await sidecarSources(context);
    for (const [directory, side] of [
      [head, "head"],
      [base, "base"],
    ]) {
      const preset = path.join(directory!, "packages/preset");
      await fs.mkdir(preset, { recursive: true });
      await fs.writeFile(
        path.join(preset, "package.json"),
        JSON.stringify({
          name: "preset",
          main: "index.mjs",
          exports: { ".": "./index.mjs", "./common": "./index.cjs" },
        }),
      );
      await fs.writeFile(
        path.join(preset, "value.mjs"),
        `export default '${side}';`,
      );
      await fs.writeFile(
        path.join(preset, "value.cjs"),
        `module.exports='${side}';`,
      );
      await fs.writeFile(
        path.join(preset, "index.mjs"),
        `import side from './value.mjs'; export default ()=>({postcssPlugin:'preset',Once(root){root.append({prop:'preset',value:side})}});`,
      );
      await fs.writeFile(
        path.join(preset, "index.cjs"),
        `const side=require('./value.cjs'); module.exports=()=>({postcssPlugin:'preset',Once(root){root.append({prop:'preset',value:side})}});`,
      );
      for (const [mode, code] of [
        [
          "static",
          `import preset from 'preset'; export default {plugins:[preset()]};`,
        ],
        ["record", `export default {plugins:{preset:{}}};`],
        [
          "dynamic",
          `const name='preset'; const {default:preset}=await import(name); export default {plugins:[preset()]};`,
        ],
        [
          "require",
          `const name='preset/common'; const preset=require(name); export default {plugins:[preset()]};`,
        ],
      ])
        await fs.writeFile(path.join(directory!, `${mode}.mjs`), code!);
    }
    const modules = path.join(head, "node_modules");
    await fs.mkdir(modules);
    if (layout === "npm")
      await fs.symlink(
        path.join(head, "packages/preset"),
        path.join(modules, "preset"),
        "junction",
      );
    else {
      const store = path.join(
        modules,
        ".pnpm/preset@file+packages+preset/node_modules",
      );
      await fs.mkdir(store, { recursive: true });
      await fs.symlink(
        path.join(head, "packages/preset"),
        path.join(store, "preset"),
        "junction",
      );
      await fs.symlink(
        path.join(store, "preset"),
        path.join(modules, "preset"),
        "junction",
      );
    }
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    for (const mode of ["static", "record", "dynamic", "require"]) {
      const result = await sidecar.call<CssResult>(
        "processCss",
        cssParams({
          context: mode,
          sourceRoot: base,
          repositoryRoots: [head],
          postcss: `${mode}.mjs`,
          moduleResolution: {
            ...bundleParams().moduleResolution,
            packageRoots: [head],
          },
          text: ".a {}",
        }),
      );
      assert.match(result.text, /preset: base/);
      assert.ok(
        result.dependencies.some(
          (dependency) =>
            dependency.path ===
            path.join(
              base,
              `packages/preset/value.${mode === "require" ? "cjs" : "mjs"}`,
            ),
        ),
      );
      assert.ok(
        result.dependencies.every(
          (dependency) =>
            !dependency.path.startsWith(path.join(head, "packages")),
        ),
      );
    }
  });

test("a symlinked PostCSS source root retains dynamic CommonJS dependencies", async (context) => {
  const { root, base } = await sidecarSources(context);
  const alias = path.join(root, "alias");
  await fs.symlink(base, alias, "junction");
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `const name='./helper.cjs'; const helper=require(name); export default {plugins:[{postcssPlugin:'symlink',Once(root){root.append({prop:'helper',value:helper})}}]};`,
  );
  await fs.writeFile(path.join(base, "helper.cjs"), `module.exports='base';`);
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({ sourceRoot: alias, text: ".a{}" }),
  );
  assert.match(result.text, /helper: base/);
  assert.ok(
    result.dependencies.some(
      (dependency) => dependency.path === path.join(base, "helper.cjs"),
    ),
  );
});

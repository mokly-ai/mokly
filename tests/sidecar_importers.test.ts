import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";

import {
  bundleParams,
  cssParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";
import { dependency, sidecarSources } from "./helpers/sidecar_sources.js";

for (const tier of ["working", "installed"]) {
  test(`base imports use each importer's ${tier} dependency directory`, async (context) => {
    const { root, head, base } = await sidecarSources(context);
    const selected = tier === "working" ? head : path.join(root, "installed");
    await fs.mkdir(path.join(selected, "apps/web"), { recursive: true });
    await fs.mkdir(path.join(base, "apps/web"), { recursive: true });
    await dependency(selected, "fixture-version", "export default 'root';");
    await dependency(
      path.join(selected, "apps/web"),
      "fixture-version",
      "export default 'app';",
    );
    for (const name of ["a", "b"]) {
      const pkg = await dependency(
        path.join(selected, `packages/${name}`),
        "fixture-version",
        `export default '${tier}-${name}';`,
      );
      await fs.writeFile(path.join(pkg, "style.css"), ".fixture{color:red}");
      for (const source of [head, base]) {
        await fs.mkdir(path.join(source, `packages/${name}`), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(source, `packages/${name}/local.mjs`),
          `export default '${source === base ? "base" : "head"}';`,
        );
      }
      await fs.writeFile(
        path.join(base, `packages/${name}/page.ts`),
        `import value from 'fixture-version'; import 'fixture-version/style.css'; import local from './local.mjs'; import {definePage} from '@mokly/mokly'; export default definePage({title:'${name}',description:'',relatedDocs:[],render:()=>'<html>'+local+':'+value+'</html>'});`,
      );
    }
    const sidecar = startSidecar(context, base);
    await sidecar.call("hello");
    const params = bundleParams({
      sourceRoot: base,
      repositoryRoots: [head, selected],
      configurationDirectory: "apps/web",
      entryFiles: ["packages/a/page.ts", "packages/b/page.ts"],
      storiesFiles: [],
      renderer: null,
      moduleResolution: {
        ...bundleParams().moduleResolution,
        dependencyRoot: selected,
        packageRoots: [path.join(selected, "apps/web"), selected],
      },
    });
    const result = await sidecar.call<BundleResult>("bundle", params);
    for (const name of ["a", "b"])
      assert.ok(
        result.modules.some(
          (module) =>
            module.path ===
            `packages/${name}/node_modules/fixture-version/index.mjs`,
        ),
      );
    await sidecar.call("cssModules", {
      generation: result.generation,
      classMaps: {},
    });
    const entries = Object.fromEntries(
      ["a", "b"].map((name) => [
        `packages/${name}/page.ts#default`,
        { path: name, title: name },
      ]),
    );
    await installBindings(sidecar, result.generation, entries);
    for (const name of ["a", "b"]) {
      const rendered = await sidecar.call<PageResult>("renderPage", {
        generation: result.generation,
        handle: `packages/${name}/page.ts#default`,
      });
      assert.equal(rendered.html, `<html>base:${tier}-${name}</html>`);
    }
    const cached = await sidecar.call<BundleResult>("bundle", params);
    assert.deepEqual(cached.modules, result.modules);
    assert.equal(
      sidecar.operations.filter((event) => event.operation === "esbuild")
        .length,
      1,
    );
    await sidecar.call("shutdown");
    const restored = startSidecar(context, base);
    await restored.call("hello");
    await restored.call("restoreGeneration", {
      generation: result.generation,
      params,
      compiled: result.compiled,
      modules: result.modules,
    });
    await restored.call("cssModules", {
      generation: result.generation,
      classMaps: {},
    });
    await installBindings(restored, result.generation, entries);
    const replay = await restored.call<BundleResult>("bundle", params);
    assert.equal(replay.generation, result.generation);
    await restored.call("cssModules", {
      generation: replay.generation,
      classMaps: {},
    });
    await installBindings(restored, replay.generation, entries);
    assert.equal(
      restored.operations.filter((event) => event.operation === "esbuild")
        .length,
      0,
    );
    await fs.writeFile(
      path.join(selected, "packages/a/node_modules/fixture-version/index.mjs"),
      "export default 'updated';",
    );
    const updated = await restored.call<BundleResult>("bundle", params);
    assert.notEqual(updated.generation, result.generation);
    await restored.call("cssModules", {
      generation: updated.generation,
      classMaps: {},
    });
    await installBindings(restored, updated.generation, entries);
    for (const [generation, value] of [
      [result.generation, `${tier}-a`],
      [updated.generation, "updated"],
    ]) {
      const rendered = await restored.call<PageResult>("renderPage", {
        generation,
        handle: "packages/a/page.ts#default",
      });
      assert.equal(rendered.html, `<html>base:${value}</html>`);
    }
    await restored.call("shutdown");
  });

  for (const form of ["import", "require", "dynamic", "record"]) {
    test(`base PostCSS ${form} uses its importer in ${tier} dependencies`, async (context) => {
      const { root, head, base } = await sidecarSources(context);
      const selected = tier === "working" ? head : path.join(root, "installed");
      const plugin = (color: string) =>
        `module.exports=()=>({postcssPlugin:'fixture',Once(root){root.append({selector:'.hit',nodes:[{prop:'color',value:'${color}'}]});}});`;
      await dependency(selected, "fixture-plugin", plugin("red"), "cjs");
      await dependency(
        path.join(selected, "packages/ui"),
        "fixture-plugin",
        plugin("blue"),
        "cjs",
      );
      await fs.mkdir(path.join(base, "packages/ui"), { recursive: true });
      const source =
        form === "record"
          ? "export default {plugins:{'fixture-plugin':{}}};"
          : `${form === "import" ? "import plugin from 'fixture-plugin';" : form === "dynamic" ? "const {default:plugin}=await import('fixture-plugin');" : "const plugin=require('fixture-plugin');"} export default {plugins:[plugin()]};`;
      await fs.writeFile(path.join(base, "packages/ui/postcss.mjs"), source);
      const sidecar = startSidecar(context, base);
      await sidecar.call("hello");
      const result = await sidecar.call<CssResult>(
        "processCss",
        cssParams({
          sourceRoot: base,
          repositoryRoots: [head, selected],
          postcss: "packages/ui/postcss.mjs",
          moduleResolution: {
            ...bundleParams().moduleResolution,
            dependencyRoot: selected,
            packageRoots: [selected],
          },
        }),
      );
      assert.match(result.text, /color: blue/);
      assert.doesNotMatch(result.text, /color: red/);
      await sidecar.call("shutdown");
    });
  }
}

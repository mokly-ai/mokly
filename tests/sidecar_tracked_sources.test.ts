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

for (const directory of ["", "src"]) {
  test(`base source dependencies win over tier-one copies beneath ${directory || "the root"}`, async (context) => {
    const { head, base } = await sidecarSources(context);
    for (const [root, value] of [
      [head, "head"],
      [base, "base"],
    ]) {
      await fs.mkdir(path.join(root!, "apps/web"), { recursive: true });
      const pkg = await dependency(
        path.join(root!, directory),
        "fixture-source",
        `export default '${value}';`,
      );
      await fs.writeFile(
        path.join(pkg, "style.css"),
        `.fixture{color:${value === "base" ? "blue" : "red"}}`,
      );
    }
    await fs.mkdir(path.join(base, "src"), { recursive: true });
    await fs.writeFile(
      path.join(base, "src/page.ts"),
      "import {definePage} from '@mokly/mokly'; import value from 'fixture-source'; import 'fixture-source/style.css'; export default definePage({title:'Page',description:'',relatedDocs:[],render:()=>'<html>'+value+'</html>'});",
    );
    const sidecar = startSidecar(context, base);
    await sidecar.call("hello");
    const result = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        sourceRoot: base,
        repositoryRoots: [head],
        configurationDirectory: "apps/web",
        entryFiles: ["src/page.ts"],
        storiesFiles: [],
        renderer: null,
        moduleResolution: {
          ...bundleParams().moduleResolution,
          dependencyRoot: head,
          packageRoots: [path.join(head, "apps/web"), head],
        },
      }),
    );
    const prefix = directory
      ? "src/node_modules"
      : "node_modules/.mokly-roots/1";
    for (const file of ["index.mjs", "style.css"])
      assert.ok(
        result.modules.some(
          (module) => module.path === `${prefix}/fixture-source/${file}`,
        ),
      );
    await sidecar.call("cssModules", {
      generation: result.generation,
      classMaps: {},
    });
    await installBindings(sidecar, result.generation, {
      "src/page.ts#default": { path: "page", title: "Page" },
    });
    const page = await sidecar.call<PageResult>("renderPage", {
      generation: result.generation,
      handle: "src/page.ts#default",
    });
    assert.equal(page.html, "<html>base</html>");
    await sidecar.call("shutdown");
  });

  test(`PostCSS input paths use source dependency bytes beneath ${directory || "the root"}`, async (context) => {
    const { head, base } = await sidecarSources(context);
    for (const [root, color] of [
      [head, "red"],
      [base, "blue"],
    ]) {
      await fs.mkdir(path.join(root!, "apps/web"), { recursive: true });
      const pkg = await dependency(
        path.join(root!, directory),
        "fixture-source",
        "export default null;",
      );
      await fs.writeFile(
        path.join(pkg, "style.css"),
        `.fixture{color:${color}}`,
      );
    }
    await fs.writeFile(
      path.join(base, "postcss.mjs"),
      "import {readFileSync} from 'node:fs'; export default {plugins:[{postcssPlugin:'source-read',Once(root,{result}){root.removeAll(); root.append(readFileSync(result.opts.from,'utf8'));}}]};",
    );
    const sidecar = startSidecar(context, base);
    await sidecar.call("hello");
    const prefix = directory
      ? "src/node_modules"
      : "node_modules/.mokly-roots/1";
    const result = await sidecar.call<CssResult>(
      "processCss",
      cssParams({
        sourceRoot: base,
        repositoryRoots: [head],
        postcss: "postcss.mjs",
        sourcePath: `${prefix}/fixture-source/style.css`,
        text: ".fixture{color:blue}",
        moduleResolution: {
          ...bundleParams().moduleResolution,
          dependencyRoot: head,
          packageRoots: [path.join(head, "apps/web"), head],
        },
      }),
    );
    assert.match(result.text, /color:blue/);
    assert.doesNotMatch(result.text, /red/);
    await sidecar.call("shutdown");
  });
}

test("PostCSS children replace inherited head directory variables", async (context) => {
  const { head, base } = await sidecarSources(context);
  await fs.writeFile(path.join(head, "origin.txt"), "head");
  await fs.writeFile(path.join(base, "origin.txt"), "base");
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    "import {readFileSync} from 'node:fs'; export default {plugins:[{postcssPlugin:'environment',Once(root){if(process.env.INIT_CWD!==undefined||process.env.npm_package_json!==undefined||process.env.npm_config_local_prefix!==undefined)throw new Error('npm directory variables leaked');root.append({selector:'.env',nodes:[{prop:'--origin',value:readFileSync(process.env.PWD+'/origin.txt','utf8')}]});}}]};",
  );
  const sidecar = startSidecar(context, head, {
    ...process.env,
    PWD: head,
    INIT_CWD: head,
    npm_package_json: path.join(head, "package.json"),
    npm_config_local_prefix: head,
  });
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({
      sourceRoot: base,
      repositoryRoots: [head],
      postcss: "postcss.mjs",
      text: "",
      moduleResolution: {
        ...bundleParams().moduleResolution,
        dependencyRoot: head,
        packageRoots: [head],
      },
    }),
  );
  assert.match(result.text, /--origin:\s*base/);
  assert.doesNotMatch(result.text, /head/);
  await sidecar.call("shutdown");
});

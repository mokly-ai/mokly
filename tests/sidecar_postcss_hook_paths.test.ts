import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { dependency, sidecarSources } from "./helpers/sidecar_sources.js";

for (const mode of [
  "--loader",
  "--experimental-loader",
  "--import",
  "--require",
])
  test(
    `${mode} retains short-circuited transitive paths after repeated registration`,
    { timeout: 30_000 },
    async (context) => {
      const { base } = await sidecarSources(context);
      const helper = path.join(base, "hidden-helper.mjs");
      const leaf = path.join(base, "hidden-leaf.mjs");
      for (const file of [helper, leaf])
        await fs.writeFile(file, "export default 'raw';");
      const urls = [helper, leaf].map((file) => pathToFileURL(file).href);
      const sources = [
        "export { default } from 'hidden-leaf';",
        "export default 'transformed';",
      ];
      const hooks = `const urls=${JSON.stringify(urls)};
const sources=${JSON.stringify(sources)};
function resolve(specifier,context,nextResolve){
  const index=['hidden-helper','hidden-leaf'].indexOf(specifier);
  return index<0?nextResolve(specifier,context):{url:urls[index],shortCircuit:true};
}
function load(url,context,nextLoad){
  const index=urls.indexOf(url);
  return index<0?nextLoad(url,context):{format:'module',source:sources[index],shortCircuit:true};
}`;
      const loader = path.join(base, "loader.mjs");
      await fs.writeFile(loader, hooks + "\nexport {resolve,load};");
      const preload = path.join(base, "preload.cjs");
      await fs.writeFile(
        preload,
        `const {register}=require('node:module'); register(${JSON.stringify(pathToFileURL(loader).href)}); register(${JSON.stringify(pathToFileURL(loader).href)});`,
      );
      await dependency(
        base,
        "plugin",
        `import value from 'hidden-helper'; export default ()=>({postcssPlugin:'loader',Once(root){root.walkDecls('color',decl=>decl.value=value)}});`,
      );
      await fs.writeFile(
        path.join(base, "postcss.mjs"),
        "export default {plugins:{plugin:{}}};",
      );
      const flag = mode;
      const entry = mode.includes("loader") ? loader : preload;
      const sidecar = startSidecar(context, undefined, {
        ...process.env,
        NODE_OPTIONS: `${flag}=${JSON.stringify(flag === "--require" ? entry : pathToFileURL(entry).href)}`,
      });
      await sidecar.call("hello");
      const params = cssParams({
        sourceRoot: base,
        repositoryRoots: [],
        text: "a{color:black}",
      });
      params.moduleResolution.packageRoots = [base];
      for (let request = 0; request < 2; request++) {
        const result = await sidecar.call<CssResult>("processCss", params);
        assert.match(result.text, /color:transformed/u);
        for (const file of [helper, leaf]) {
          assert.ok(
            result.readEvidence.modules.includes(file),
            `missing loader path ${file}`,
          );
          assert.equal(
            result.readEvidence.reads.some((read) => read.path === file),
            false,
            "synthetic module source must not become a raw witness",
          );
        }
        assert.equal(result.readEvidence.coverage, "incomplete");
      }
      await sidecar.call("shutdown");
    },
  );

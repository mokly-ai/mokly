import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { dependency, sidecarSources } from "./helpers/sidecar_sources.js";

for (const mode of ["synchronous", "asynchronous"])
  test(
    `${mode} hooks that a plugin registers retain short-circuited paths`,
    { timeout: 30_000 },
    async (context) => {
      const { base } = await sidecarSources(context);
      const helper = path.join(base, "hidden-helper.mjs");
      await fs.writeFile(helper, "export default 'raw';");
      const url = JSON.stringify(pathToFileURL(helper).href);
      const hooks = `function resolve(specifier,context,nextResolve){
  return specifier==='hidden-helper'?{url:${url},shortCircuit:true}:nextResolve(specifier,context);
}
function load(url,context,nextLoad){
  return url===${url}?{format:'module',source:"export default 'transformed';",shortCircuit:true}:nextLoad(url,context);
}`;
      const loader = path.join(base, "loader.mjs");
      await fs.writeFile(loader, hooks + "\nexport {resolve,load};");
      const registration =
        mode === "synchronous"
          ? `${hooks}\nregisterHooks({resolve,load});`
          : `register(${JSON.stringify(pathToFileURL(loader).href)});`;
      await dependency(
        base,
        "plugin",
        `import {register,registerHooks} from 'node:module';
${registration}
const {default:value}=await import('hidden-helper');
export default ()=>({postcssPlugin:'runtime',Once(root){root.walkDecls('color',decl=>{decl.value=value})}});`,
      );
      await fs.writeFile(
        path.join(base, "postcss.mjs"),
        "export default {plugins:{plugin:{}}};",
      );
      const sidecar = startSidecar(context);
      await sidecar.call("hello");
      const params = cssParams({
        sourceRoot: base,
        repositoryRoots: [],
        text: "a{color:black}",
      });
      params.moduleResolution.packageRoots = [base];
      const result = await sidecar.call<CssResult>("processCss", params);
      assert.match(result.text, /color:transformed/u);
      assert.ok(
        result.readEvidence.modules.includes(helper),
        `missing plugin hook path ${helper}`,
      );
      assert.equal(
        result.readEvidence.reads.some((read) => read.path === helper),
        false,
        "synthetic module source must not become a raw witness",
      );
      assert.equal(result.readEvidence.coverage, "incomplete");
      await sidecar.call("shutdown");
    },
  );

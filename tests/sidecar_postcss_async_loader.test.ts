import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { dependency, sidecarSources } from "./helpers/sidecar_sources.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

for (const flag of ["--loader", "--experimental-loader"])
  test(`${flag} keeps the range witness of a consumer preload descriptor read`, async (context) => {
    const { base } = await sidecarSources(context);
    const tokens = path.join(base, "tokens.txt");
    await fs.writeFile(tokens, "tokenvalue");
    const preload = path.join(base, "preload.cjs");
    await fs.writeFile(
      preload,
      `const fs=require('node:fs');
const fd=fs.openSync(${JSON.stringify(tokens)},'r');
const buffer=Buffer.alloc(64);
const length=fs.readSync(fd,buffer,0,64,null);
fs.closeSync(fd);
globalThis.preloadedToken=buffer.subarray(0,length).toString();`,
    );
    await dependency(
      base,
      "plugin",
      `export default ()=>({postcssPlugin:'token',Once(root,{result}){
root.walkDecls('color',decl=>{decl.value=globalThis.preloadedToken});
result.messages.push({type:'dependency',plugin:'token',file:${JSON.stringify(tokens)}});
}});`,
    );
    await fs.writeFile(
      path.join(base, "postcss.mjs"),
      "export default {plugins:{plugin:{}}};",
    );
    const loader = path.join(base, "loader.mjs");
    await fs.writeFile(
      loader,
      "export async function resolve(specifier,context,nextResolve){return nextResolve(specifier,context);}",
    );
    const sidecar = startSidecar(context, undefined, {
      ...process.env,
      NODE_OPTIONS: `${flag}=${pathToFileURL(loader).href} --require=${JSON.stringify(preload)}`,
    });
    await sidecar.call("hello");
    const params = cssParams({
      sourceRoot: base,
      repositoryRoots: [],
      text: "a{color:black}",
    });
    params.moduleResolution.packageRoots = [base];
    const result = await sidecar.call<CssResult>("processCss", params);
    assert.match(result.text, /color:tokenvalue/u);
    assert.deepEqual(
      result.readEvidence.reads
        .filter((read) => read.path === tokens)
        .map((read) =>
          read.kind === "byte-range"
            ? [read.offset, read.length, read.digest]
            : [read.kind],
        ),
      [[0, 10, createHash("sha256").update("tokenvalue").digest("hex")]],
      "a module.register call by Mokly must not hide earlier preload ranges",
    );
    assert.equal(result.readEvidence.coverage, "incomplete");
    await sidecar.call("shutdown");
  });

for (const flag of ["--loader", "--experimental-loader", "--import"])
  test(`${flag} preserves transformed PostCSS output without a false raw witness`, async (context) => {
    const base = await publicationFixture();
    context.after(() => fs.rm(base, { recursive: true, force: true }));
    const plugin = path.join(base, "node_modules/plugin");
    await fs.mkdir(plugin, { recursive: true });
    await fs.writeFile(
      path.join(plugin, "package.json"),
      JSON.stringify({ name: "plugin", type: "module", main: "index.mjs" }),
    );
    const module = path.join(plugin, "index.mjs");
    const original =
      "import value from './color.mjs';export default ()=>({postcssPlugin:'plugin',Once(root){root.walkDecls('color',decl=>decl.value='raw-'+value)}});";
    await fs.writeFile(module, original);
    // Node resolves this helper, so only Mokly's path observer can report it.
    const helper = path.join(plugin, "color.mjs");
    const helperSource = "export default 'raw';";
    await fs.writeFile(helper, helperSource);
    await fs.writeFile(
      path.join(base, "postcss.mjs"),
      "export default {plugins:{plugin:{}}};",
    );
    const loader = path.join(base, "loader.mjs");
    await fs.writeFile(
      loader,
      `export async function load(url,context,nextLoad){
const result=await nextLoad(url,context);
if(url===${JSON.stringify(pathToFileURL(module).href)})
return {...result,source:Buffer.from(${JSON.stringify(original.replace("'raw-'", "'transformed-'"))})};
if(url===${JSON.stringify(pathToFileURL(helper).href)})
return {...result,source:Buffer.from(${JSON.stringify(helperSource.replace("'raw'", "'transformed'"))})};
return result;
}`,
    );
    const target = path.join(base, "tokens.txt");
    await fs.writeFile(target, "early");
    const preload = path.join(base, "preload.cjs");
    await fs.writeFile(
      preload,
      `require('node:fs').readFileSync(${JSON.stringify(target)},'utf8');`,
    );
    const registration = path.join(base, "registration.mjs");
    await fs.writeFile(
      registration,
      `import {register} from 'node:module'; register(${JSON.stringify(pathToFileURL(loader).href)});`,
    );
    const entry = flag === "--import" ? registration : loader;
    const env = {
      ...process.env,
      NODE_OPTIONS: `${flag}=${pathToFileURL(entry).href} --require=${JSON.stringify(preload)}`,
    };
    const sidecar = startSidecar(context, undefined, env);
    await sidecar.call("hello");
    const params = cssParams({
      sourceRoot: base,
      repositoryRoots: [],
      text: "a{color:black}",
    });
    params.moduleResolution.packageRoots = [base];
    const result = await sidecar.call<CssResult>("processCss", params);
    assert.match(result.text, /color:transformed-transformed/u);
    for (const [file, source] of [
      [module, original],
      [helper, helperSource],
    ] as const)
      assert.ok(
        result.readEvidence.reads
          .filter((read) => read.path === file)
          .every(
            (read) =>
              read.digest === createHash("sha256").update(source).digest("hex"),
          ),
        "loader output cannot certify raw bytes",
      );
    assert.ok(
      result.readEvidence.modules.includes(module),
      "the configured plugin keeps its resolved path",
    );
    assert.ok(
      result.readEvidence.modules.includes(helper),
      "asynchronous loaders must report supplied module paths",
    );
    assert.ok(
      result.readEvidence.reads.some(
        (read) =>
          read.path === target &&
          read.digest === createHash("sha256").update("early").digest("hex"),
      ),
      "ordinary consumer preloads still retain their raw reads",
    );
    assert.equal(result.readEvidence.coverage, "incomplete");
    await sidecar.call("shutdown");
    await fs.writeFile(path.join(base, "theme.css"), "a{color:black}");
    await fs.writeFile(
      path.join(base, "mokly.config.json"),
      JSON.stringify({
        postcss: "postcss.mjs",
        stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
      }),
    );
    const build = await command(
      base,
      "build",
      ["--no-changes", "--out=.context/site"],
      "plain",
      env,
      context.signal,
    ).result;
    assert.equal(build.code, 0, build.stderr);
  });

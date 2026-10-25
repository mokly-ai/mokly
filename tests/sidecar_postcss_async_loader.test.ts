import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { MessageChannel, receiveMessageOnPort } from "node:worker_threads";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";
import {
  initialize,
  resolve as resolveAsyncModule,
} from "../packages/mokly/src/sidecar/postcss-async-loader.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

test("async loader paths queue before resolve returns", async (context) => {
  const { port1, port2 } = new MessageChannel();
  context.after(() => {
    port1.close();
    port2.close();
  });
  initialize({ paths: port1 });
  const resolved = { url: "file:///module.mjs", format: "module" };
  const pending = resolveAsyncModule("module", {}, async () => resolved);
  assert.equal(receiveMessageOnPort(port2), undefined);
  assert.equal(await pending, resolved);
  assert.deepEqual(receiveMessageOnPort(port2), { message: resolved.url });
  assert.equal(receiveMessageOnPort(port2), undefined);
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
      "export default ()=>({postcssPlugin:'plugin',Once(root){root.walkDecls('color',decl=>decl.value='raw')}});";
    await fs.writeFile(module, original);
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
return {...result,source:Buffer.from(${JSON.stringify(original.replace("'raw'", "'transformed'"))})};
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
    assert.match(result.text, /color:transformed/u);
    assert.ok(
      result.readEvidence.reads
        .filter((read) => read.path === module)
        .every(
          (read) =>
            read.digest === createHash("sha256").update(original).digest("hex"),
        ),
      "loader output cannot certify raw bytes",
    );
    assert.ok(
      result.readEvidence.modules.includes(module),
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

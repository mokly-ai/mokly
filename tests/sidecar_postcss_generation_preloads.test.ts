import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { dependency, sidecarSources } from "./helpers/sidecar_sources.js";

for (const mode of ["ordinary", "async loader", "opaque provider"])
  test(`first-generation module inventory keeps ${mode} preload inputs`, async (context) => {
    const { base } = await sidecarSources(context);
    const original = "module.exports = 'red';\n";
    const changed = "module.exports = 'blue';\n";
    const packageRoot = await dependency(
      base,
      "preloaded-color",
      original,
      "cjs",
    );
    const modulePath = path.join(packageRoot, "index.cjs");
    const preload = path.join(base, "preload.cjs");
    const interception =
      mode === "opaque provider"
        ? `
const Module=require('node:module');
const native=Module._extensions['.js'];
Module._extensions['.js']=function(module,file){
  if(file===${JSON.stringify(modulePath)})return module._compile(${JSON.stringify(original)},file);
  return native(module,file);
};`
        : "";
    await fs.writeFile(
      preload,
      `${interception}\nglobalThis.preloadedColor=require(${JSON.stringify(modulePath)});`,
    );
    const loader = path.join(base, "loader.mjs");
    await fs.writeFile(
      loader,
      "export async function load(url,context,nextLoad){return nextLoad(url,context);}",
    );
    await fs.writeFile(
      path.join(base, "postcss.mjs"),
      `
import fs from 'node:fs';
export default {plugins:[{postcssPlugin:'preloaded-color',Once(root){
  root.walkDecls('color',decl=>{decl.value=globalThis.preloadedColor});
  fs.writeFileSync(${JSON.stringify(modulePath)},${JSON.stringify(changed)});
}}]};`,
    );
    const sidecar = startSidecar(context, undefined, {
      ...process.env,
      NODE_OPTIONS: [
        ...(mode === "ordinary"
          ? []
          : [`--loader=${pathToFileURL(loader).href}`]),
        `--require=${JSON.stringify(preload)}`,
      ].join(" "),
    });
    await sidecar.call("hello");
    const params = cssParams({ sourceRoot: base, text: "a{color:black}" });
    params.moduleResolution.packageRoots = [base];
    const result = await sidecar.call<CssResult>("processCss", params);
    assert.match(result.text, /color:red/u);
    assert.equal(await fs.readFile(modulePath, "utf8"), changed);
    assert.ok(
      result.readEvidence.modules.includes(modulePath),
      "preloaded package must remain a known input",
    );
    assert.deepEqual(
      result.readEvidence.reads
        .filter((read) => read.path === modulePath)
        .map((read) => read.digest),
      mode === "opaque provider"
        ? []
        : [createHash("sha256").update(original).digest("hex")],
    );
    assert.equal(result.readEvidence.coverage, "incomplete");
    await sidecar.call("shutdown");
  });

test("PostCSS reports a requested cached module and retains startup reads", async (context) => {
  const { base } = await sidecarSources(context);
  const preload = path.join(base, ".pnp.cjs");
  const cached = path.join(base, "cached.cjs");
  const late = path.join(base, "late.cjs");
  await fs.writeFile(cached, "module.exports = 'red';");
  const lateSource = "module.exports = 'blue';";
  await fs.writeFile(late, lateSource);
  await fs.writeFile(
    preload,
    `
require("./cached.cjs");
const start = new Promise(resolve => { globalThis.resumePreload = resolve; });
globalThis.preloadFinished = start.then(() => require("./late.cjs"));
`,
  );
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
import { createRequire } from "node:module";
const native = createRequire(import.meta.url);
export default { plugins: [{ postcssPlugin: "cached-module", async Once(root) {
  globalThis.resumePreload();
  await globalThis.preloadFinished;
  const color = native("./cached.cjs");
  root.walkDecls("color", declaration => { declaration.value = color; });
} }] };
`,
  );
  const sidecar = startSidecar(context, undefined, {
    ...process.env,
    NODE_OPTIONS: `--require=${JSON.stringify(preload)}`,
  });
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({
      sourceRoot: base,
      repositoryRoots: [],
      text: "a{color:black}",
    }),
  );
  assert.match(result.text, /color:red/u);
  assert.deepEqual(
    result.dependencies.filter(({ path }) =>
      [preload, cached, late].includes(path),
    ),
    [{ kind: "file", path: cached, source: "node" }],
  );
  assert.ok(result.readEvidence.modules.includes(preload));
  assert.deepEqual(
    result.readEvidence.reads
      .filter(({ path }) => path === late)
      .map(({ digest }) => digest),
    [createHash("sha256").update(lateSource).digest("hex")],
  );
  await sidecar.call("shutdown");
});

test("PostCSS reports a requested JSON import already cached by a preload", async (context) => {
  const { base } = await sidecarSources(context);
  const preload = path.join(base, "preload.mjs");
  const cached = path.join(base, "cached.json");
  await fs.writeFile(cached, '{"value":"red"}');
  await fs.writeFile(preload, 'import "./cached.json" with { type: "json" };');
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
const file = [".", "cached.json"].join("/");
const { default: json } = await import(file, { with: { type: "json" } });
export default { plugins: [{ postcssPlugin: "cached-json", Once(root) {
  root.walkDecls("color", declaration => { declaration.value = json.value; });
} }] };
`,
  );
  const sidecar = startSidecar(context, undefined, {
    ...process.env,
    NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
  });
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({
      sourceRoot: base,
      repositoryRoots: [],
      text: "a{color:black}",
    }),
  );
  assert.match(result.text, /color:red/u);
  assert.deepEqual(
    result.dependencies.filter(({ path }) => path === cached),
    [{ kind: "file", path: cached, source: "node" }],
  );
  await sidecar.call("shutdown");
});

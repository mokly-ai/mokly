import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import {
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

test("marked edits reject an earlier mapped CSS target and route its class map", async (context) => {
  const root = await nativeRoot(context);
  const params = nativeParams(root);
  await write(path.join(root, "package.json"), "{}");
  await write(path.join(root, "one/.keep"), "");
  await write(path.join(root, "two/style.module.css"), ".item {color:blue}");
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"paths":{"@/*":["./one/*","./two/*"]}}}',
  );
  await write(
    path.join(root, "entry.mjs"),
    "import styles from '@/style.module.css'; export const value=styles.item;",
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  first.generation.maps = { "two/style.module.css": { item: "two-item" } };
  assert.equal(
    evaluate(first.generation).entries["entry.mjs"]!.value,
    "two-item",
  );
  assert.deepEqual(first.result.compiled.cssModules, ["two/style.module.css"]);
  assert.deepEqual(
    first.result.modules.map(({ path, imports }) => ({ path, imports })),
    [
      { path: "entry.mjs", imports: ["two/style.module.css"] },
      { path: "two/style.module.css", imports: [] },
    ],
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await write(path.join(root, "one/style.module.css"), ".item {color:red}");
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  fresh.generation.maps = { "one/style.module.css": { item: "one-item" } };
  assert.equal(
    evaluate(fresh.generation).entries["entry.mjs"]!.value,
    "one-item",
  );
  assert.deepEqual(fresh.result.compiled.cssModules, ["one/style.module.css"]);
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
    "an earlier mapped stylesheet must reject marked reuse",
  );
});

test("marked edits reject an earlier style wrapper target and retain its registry dependency", async (context) => {
  const root = await nativeRoot(context);
  const params = nativeParams(root);
  await write(path.join(root, "package.json"), "{}");
  await write(path.join(root, "one/.keep"), "");
  await write(
    path.join(root, "two/theme.mjs"),
    "export default {source:'two'};",
  );
  await write(
    path.join(root, "registry.mjs"),
    "export default {source:'registry'};",
  );
  await write(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        paths: {
          "styled-components/theme": ["./one/theme.mjs", "./two/theme.mjs"],
          "styled-components": ["./registry.mjs"],
        },
      },
    }),
  );
  await write(
    path.join(root, "entry.mjs"),
    "import styled from 'styled-components/theme'; export const value=styled.source;",
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  assert.deepEqual(
    first.result.modules.map(({ path, imports }) => ({ path, imports })),
    [
      {
        path: "entry.mjs",
        imports: ["two/theme.mjs", "two/theme.mjs", "registry.mjs"],
      },
      { path: "registry.mjs", imports: [] },
      { path: "two/theme.mjs", imports: [] },
    ],
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await write(
    path.join(root, "one/theme.mjs"),
    "export default {source:'one'};",
  );
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
    "an earlier wrapped style module must reject marked reuse",
  );
});

test("JSX and authoring modules keep marked reuse with baseUrl enabled", async (context) => {
  const root = await nativeRoot(context);
  const params = nativeParams(root, { entryFiles: ["entry.jsx"] });
  await write(path.join(root, "package.json"), "{}");
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"baseUrl":"."}}',
  );
  const react = await packageAt(
    path.join(root, "node_modules/react"),
    "react",
    "module.exports={};",
    "index.js",
  );
  await write(
    path.join(react, "jsx-runtime.js"),
    "exports.jsx=()=>null; exports.jsxs=()=>null; exports.Fragment='fragment';",
  );
  await write(
    path.join(root, "entry.jsx"),
    "import {definePage} from '@mokly/mokly'; export const view=()=> <b>x</b>; export const page=definePage({title:'JSX',description:'',relatedDocs:[],render:()=>'<p>page</p>'});",
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(
    typeof evaluate(first.generation).entries["entry.jsx"]!.view,
    "function",
  );
  assert.deepEqual(
    first.result.modules.map(({ path, imports }) => ({ path, imports })),
    [{ path: "entry.jsx", imports: [] }],
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
});

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { link, nativeRoot, write } from "./helpers/native_resolution.js";
import {
  bundleParams,
  contextParams,
  cssParams,
  startSidecar,
} from "./helpers/sidecar.js";

test("a prepared PostCSS context runs the configured file in a workspace build folder", async (context) => {
  const root = await nativeRoot(context);
  await write(path.join(root, "package.json"), '{"name":"catalogue"}');
  await write(
    path.join(root, "dist/postcss.mjs"),
    "export default {plugins:[{postcssPlugin:'configured',Once(root){root.append({prop:'selected',value:'configured'})}}]};",
  );
  await write(
    path.join(root, "src/postcss.tsx"),
    "export default {plugins:[{postcssPlugin:'source',Once(root){root.append({prop:'selected',value:'source'})}}]};",
  );
  const moduleResolution = {
    ...bundleParams().moduleResolution,
    packageRoots: [root],
  };
  const params = cssParams({
    sourceRoot: root,
    postcss: "dist/postcss.mjs",
    moduleResolution,
    text: "a{}",
  });
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  await sidecar.call(
    "prepareContext",
    contextParams(bundleParams({ sourceRoot: root, moduleResolution }), {
      context: params.context,
      postcss: params.postcss,
    }),
  );
  const result = await sidecar.call<CssResult>("processCss", params);
  assert.match(result.text, /selected:\s*configured/);
  await sidecar.call("shutdown");
});

test("PostCSS imports and requires workspace plugins without build files", async (context) => {
  const root = await nativeRoot(context);
  const pkg = path.join(root, "packages/local");
  await write(
    path.join(pkg, "package.json"),
    JSON.stringify({
      name: "workspace-local",
      exports: {
        "./static": "./dist/static.js",
        "./dynamic": "./dist/dynamic.js",
        "./plugin": "./dist/plugin.js",
      },
    }),
  );
  await write(
    path.join(pkg, "src/static.ts"),
    'export const label = "static";',
  );
  await write(
    path.join(pkg, "src/dynamic.ts"),
    'export const label = "dynamic";',
  );
  await write(
    path.join(pkg, "src/plugin.ts"),
    'export default ({label}) => ({postcssPlugin:"source", Once(root){root.append({prop:"selected",value:label})}});',
  );
  await link(pkg, path.join(root, "node_modules/workspace-local"));
  await write(
    path.join(root, "postcss.mjs"),
    `
    import {label} from "workspace-local/static";
    const {label: dynamic} = require(["workspace-local", "dynamic"].join("/"));
    export default {plugins: {"workspace-local/plugin": {label: label + "-" + dynamic}}};
  `,
  );

  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({
      sourceRoot: root,
      postcss: "postcss.mjs",
      moduleResolution: {
        ...bundleParams().moduleResolution,
        packageRoots: [root],
      },
      text: "a{}",
    }),
  );
  assert.match(result.text, /selected:\s*static-dynamic/);
  await sidecar.call("shutdown");
});

test("a computed PostCSS require keeps an existing workspace build", async (context) => {
  const root = await nativeRoot(context);
  const pkg = path.join(root, "packages/local");
  await write(
    path.join(pkg, "package.json"),
    '{"name":"workspace-local","exports":"./dist/index.js"}',
  );
  await write(path.join(pkg, "dist/index.js"), 'module.exports = "built";');
  await write(path.join(pkg, "src/index.ts"), 'module.exports = "source";');
  await link(pkg, path.join(root, "node_modules/workspace-local"));
  await write(
    path.join(root, "postcss.mjs"),
    `
    const value = require(["workspace", "local"].join("-"));
    export default {plugins: [{postcssPlugin:"selected", Once(root) {
      root.append({prop:"selected", value});
    }}]};
  `,
  );

  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({
      sourceRoot: root,
      postcss: "postcss.mjs",
      moduleResolution: {
        ...bundleParams().moduleResolution,
        packageRoots: [root],
      },
      text: "a{}",
    }),
  );
  assert.match(result.text, /selected:\s*built/);
  await sidecar.call("shutdown");
});

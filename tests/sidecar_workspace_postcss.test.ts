import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { nativeRoot, write } from "./helpers/native_resolution.js";
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

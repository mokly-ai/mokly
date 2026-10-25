import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { bundleParams, cssParams, startSidecar } from "./helpers/sidecar.js";

test("PostCSS uses each explicit source root and side resolution policy without a bundle", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-postcss-sides-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const side of ["head", "base"]) {
    const directory = path.join(root, side);
    await fs.mkdir(path.join(directory, "node_modules/side-plugin"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(directory, "node_modules/side-plugin/package.json"),
      JSON.stringify({ name: "side-plugin", main: "index.mjs" }),
    );
    await fs.writeFile(
      path.join(directory, "node_modules/side-plugin/index.mjs"),
      `export default {postcssPlugin:'side',Once(root){root.append({prop:'side',value:'${side}'});}};`,
    );
    await fs.writeFile(
      path.join(directory, "postcss.mjs"),
      'import plugin from "configured-plugin"; export default {plugins:[plugin]};',
    );
  }
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  for (const side of ["head", "base", "head"]) {
    const sourceRoot = path.join(root, side);
    const result = await sidecar.call<CssResult>(
      "processCss",
      cssParams({
        context: side,
        sourceRoot,
        moduleResolution: {
          ...bundleParams().moduleResolution,
          aliases: { "configured-plugin": "side-plugin" },
        },
        text: ".a {}",
      }),
    );
    assert.match(result.text, new RegExp(`side: ${side}`));
  }
  await sidecar.call("disposeContext", { context: "base" });
});

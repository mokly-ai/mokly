import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import { build } from "esbuild";

import { definitionData } from "../../packages/mokly/src/authoring/runtime.js";
import type { BundleResult } from "../../packages/mokly/src/generated/sidecar/BundleResult.js";
import { bundle } from "../../packages/mokly/src/sidecar/bundle.js";
import { describe } from "../../packages/mokly/src/sidecar/describe.js";

import { bundleParams } from "./sidecar.js";

export async function fixture(context: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-asset-import-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

export async function compile(
  root: string,
  imports: string,
  expression: string,
  loaders: Record<string, string> = {},
): Promise<{ result: BundleResult; value: unknown }> {
  await fs.writeFile(
    path.join(root, "entry.mjs"),
    `import {definePage} from "@mokly/mokly";
${imports}
export default definePage({title:"Assets",description:"",relatedDocs:[],render:()=>${expression}});`,
  );
  const params = bundleParams({
    sourceRoot: root,
    entryFiles: ["entry.mjs"],
    renderer: null,
    storiesFiles: [],
  });
  params.moduleResolution.loaders = loaders;
  const built = await bundle(params, build);
  built.generation.maps = {};
  await describe(built.generation);
  const data = definitionData(
    built.generation.handles.get("entry.mjs#default"),
  );
  assert.ok(data);
  const render = data.input.render;
  assert.ok(typeof render === "function");
  return { result: built.result, value: render() };
}

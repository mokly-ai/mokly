import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

test("native exports and imports manifests retain late inventory without invented byte witnesses", async (context) => {
  const { base } = await sidecarSources(context);
  const root = path.join(base, "node_modules/plugin");
  const manifest = path.join(root, "package.json");
  await fs.mkdir(root, { recursive: true });
  const metadata = {
    name: "plugin",
    type: "module",
    exports: "./index.mjs",
    imports: { "#theme": "./red.mjs" },
  };
  await fs.writeFile(manifest, JSON.stringify(metadata));
  await fs.writeFile(path.join(root, "red.mjs"), "export default 'red';");
  await fs.writeFile(path.join(root, "blue.mjs"), "export default 'blue';");
  await fs.writeFile(
    path.join(root, "index.mjs"),
    `
import fs from 'node:fs';
import value from '#theme';
export default ()=>({postcssPlugin:'metadata',Once(root){
root.append({prop:'value',value});
fs.writeFileSync(new URL('./package.json',import.meta.url),${JSON.stringify(JSON.stringify({ ...metadata, imports: { "#theme": "./blue.mjs" } }))});
}});`,
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
    text: "a{}",
  });
  params.moduleResolution.packageRoots = [base];
  const result = await sidecar.call<CssResult>("processCss", params);
  assert.match(result.text, /value: red/u);
  assert.match(await fs.readFile(manifest, "utf8"), /blue\.mjs/u);
  assert.ok(
    result.readEvidence.modules.includes(manifest),
    "the selected package manifest must remain in the late module inventory",
  );
  assert.deepEqual(
    result.readEvidence.reads.filter((read) => read.path === manifest),
    [],
    "a path from native resolution supplies no consumed-byte proof",
  );
  assert.equal(result.readEvidence.coverage, "incomplete");
});

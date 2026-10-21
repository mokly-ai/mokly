import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

test("PostCSS witnesses local loaders and transitive native ESM, CommonJS, and JSON", async (context) => {
  const { base } = await sidecarSources(context);
  const pkg = path.join(base, "node_modules/plugin");
  await fs.mkdir(pkg, { recursive: true });
  const content = new Map<string, Buffer>();
  const write = async (name: string, bytes: Buffer | string) => {
    const raw = Buffer.from(bytes);
    content.set(path.join(base, name), raw);
    await fs.writeFile(path.join(base, name), raw);
  };
  await write(
    "node_modules/plugin/package.json",
    JSON.stringify({
      name: "plugin",
      type: "module",
      exports: { import: "./index.mjs", require: "./index.cjs" },
    }),
  );
  await write("node_modules/plugin/value.json", '\ufeff{"value":"json"}');
  await write(
    "node_modules/plugin/child.cjs",
    Buffer.concat([
      Buffer.from("//"),
      Buffer.from([0xff]),
      Buffer.from("\nmodule.exports='common';"),
    ]),
  );
  await write(
    "node_modules/plugin/index.cjs",
    "module.exports=require('./child.cjs');",
  );
  await write("node_modules/plugin/transitive.mjs", "export default 'esm';");
  await write(
    "node_modules/plugin/index.mjs",
    `
import value from './transitive.mjs';
import json from './value.json' with {type:'json'};
import {createRequire} from 'node:module';
const common=createRequire(import.meta.url)('plugin');
export default ()=>({postcssPlugin:'package',Once(root){root.append({prop:'native',value:value+'-'+json.value+'-'+common})}});`,
  );
  await write("local.json", '\ufeff{"value":"local"}');
  await write("label.txt", Buffer.from([0xef, 0xbb, 0xbf, 0x41, 0xff]));
  await write(
    "helper.ts",
    Buffer.concat([
      Buffer.from("//"),
      Buffer.from([0xff]),
      Buffer.from("\nexport const value: string = 'typescript';"),
    ]),
  );
  await write(
    "postcss.mjs",
    `
import fs from 'node:fs';
import plugin from 'plugin';
import local from './local.json';
import label from './label.txt';
import {value} from './helper.ts';
const name='plugin'; const dynamic=await import(name);
export default {plugins:[plugin(),dynamic.default(),{postcssPlugin:'local',Once(root){
root.append({prop:'local',value:local.value+'-'+value+'-'+JSON.stringify(label)});
fs.writeFileSync('node_modules/plugin/transitive.mjs', "export default 'changed';");
fs.writeFileSync('helper.ts', "export const value = 'changed';");
}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const params = cssParams({
    sourceRoot: base,
    repositoryRoots: [],
    text: "a{}",
  });
  params.moduleResolution.packageRoots = [base];
  params.moduleResolution.loaders = { ".txt": "text", ".ts": "text" };
  const result = await sidecar.call<CssResult>("processCss", params);
  assert.match(result.text, /esm-json-common/);
  assert.match(result.text, /local-typescript/);
  for (const [file, bytes] of content) {
    if (file.endsWith("package.json")) continue;
    assert.ok(
      result.readEvidence.reads.some(
        (read) =>
          read.path === file &&
          read.digest === createHash("sha256").update(bytes).digest("hex"),
      ),
      `missing raw evidence: ${file}`,
    );
  }
  assert.equal(result.readEvidence.coverage, "incomplete");
  const evaluated = path.join(pkg, "transitive.mjs");
  assert.ok(
    result.readEvidence.reads.some(
      (read) =>
        read.path === evaluated &&
        read.identity?.canonical === evaluated &&
        read.identity.object.includes(":"),
    ),
    "native module source must retain its opened-file identity",
  );
});

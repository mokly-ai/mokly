import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

function versions(result: CssResult, file: string) {
  return result.readEvidence.reads
    .filter((read) => read.path === file)
    .map((read) => read.digest);
}

test("PostCSS records raw sync, callback, and promise buffers before delivery", async (context) => {
  const { base } = await sidecarSources(context);
  const raw = Buffer.from([0xef, 0xbb, 0xbf, 0xff, 0x41]);
  for (const name of ["sync", "callback", "promise"])
    await fs.writeFile(path.join(base, `${name}.bin`), raw);
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
import fs from 'node:fs';
import {readFileSync, readFile} from 'node:fs';
import {readFile as promised} from 'node:fs/promises';
export default {plugins:[{postcssPlugin:'reads',async Once(root,{result}){
const a=readFileSync('sync.bin','utf8');
fs.writeFileSync('sync.bin','later');
const b=await new Promise((resolve,reject)=>readFile(Buffer.from('callback.bin'),{encoding:'latin1'},(error,bytes)=>{
if(error) return reject(error);
fs.writeFileSync('callback.bin','later'); resolve(bytes);
}));
const c=await promised(new URL('./promise.bin',import.meta.url));
fs.writeFileSync('promise.bin','later');
root.append({prop:'values',value:JSON.stringify([a,b,c.toString('hex')])});
for(const name of ['sync','callback','promise']) result.messages.push({type:'dependency',file:name+'.bin'});
}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const params = cssParams({
    sourceRoot: base,
    repositoryRoots: [],
    text: "a{}",
  });
  const first = await sidecar.call<CssResult>("processCss", params);
  assert.equal(first.readEvidence.coverage, "incomplete");
  for (const name of ["sync", "callback", "promise"])
    assert.deepEqual(versions(first, path.join(base, `${name}.bin`)), [
      digest(raw),
    ]);
  assert.ok(first.text.includes(raw.toString("hex")));
  assert.ok(first.text.includes("�A"));
  const second = await sidecar.call<CssResult>("processCss", params);
  for (const name of ["sync", "callback", "promise"])
    assert.deepEqual(versions(second, path.join(base, `${name}.bin`)), [
      digest(raw),
      digest("later"),
    ]);
  const configuration = path.join(base, "postcss.mjs");
  assert.deepEqual(
    versions(second, configuration),
    versions(first, configuration),
  );
  assert.equal(versions(first, configuration).length, 1);
  await sidecar.call("disposeContext", { context: params.context });
  const fresh = await sidecar.call<CssResult>("processCss", params);
  assert.deepEqual(versions(fresh, path.join(base, "sync.bin")), [
    digest("later"),
  ]);
});

test("opaque helpers and partial descriptor reads remain incomplete beside observed reads", async (context) => {
  const { base } = await sidecarSources(context);
  await fs.writeFile(path.join(base, "opaque.txt"), "opaque");
  await fs.writeFile(path.join(base, "partial.txt"), "partial");
  await fs.writeFile(path.join(base, "both.txt"), "first");
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
import fs from 'node:fs';
import {open} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const helper=file=>execFileSync(process.execPath,['-e',"process.stdout.write(require('node:fs').readFileSync(process.argv[1]))",file],{encoding:'utf8'});
export default {plugins:[{postcssPlugin:'opaque',async Once(root,{result}){
const opaque=helper('opaque.txt');
const handle=await open('partial.txt');
await handle.read(Buffer.alloc(2),0,2,1); await handle.close();
const first=fs.readFileSync('both.txt','utf8');
fs.writeFileSync('both.txt','second'); const second=helper('both.txt');
root.append({prop:'values',value:[opaque,first,second].join('-')});
for(const file of ['opaque.txt','partial.txt','both.txt']) result.messages.push({type:'dependency',file});
}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({ sourceRoot: base, repositoryRoots: [], text: "a{}" }),
  );
  assert.match(result.text, /opaque-first-second/);
  assert.equal(result.readEvidence.coverage, "incomplete");
  assert.deepEqual(versions(result, path.join(base, "opaque.txt")), []);
  assert.deepEqual(versions(result, path.join(base, "partial.txt")), []);
  assert.deepEqual(versions(result, path.join(base, "both.txt")), [
    digest("first"),
  ]);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

test("PostCSS records descriptor and FileHandle ranges before buffer mutation", async (context) => {
  const { base } = await sidecarSources(context);
  const target = path.join(base, "tokens.txt");
  await fs.writeFile(target, "abcdefg");
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {open} from 'node:fs/promises';
export default {plugins:[{postcssPlugin:'ranges',async Once(root,{result}){
const fd=fs.openSync('tokens.txt','r');
const sync=Buffer.alloc(8,255);
assert.equal(fs.readSync(fd,sync,2,2,1),2);
assert.equal(sync.subarray(2,4).toString(),'bc'); sync.fill(0);
assert.equal(fs.readSync(fd,Buffer.alloc(1),undefined,1,6),1);
const vectors=[Buffer.alloc(1),Buffer.alloc(2)];
assert.equal(fs.readvSync(fd,vectors,3),3);
for(const buffer of vectors)buffer.fill(0);
await new Promise((resolve,reject)=>fs.read(fd,{buffer:Buffer.alloc(5),offset:1,length:2,position:0},(error,count,buffer)=>{
if(error)return reject(error);assert.equal(count,2);assert.equal(buffer.subarray(1,3).toString(),'ab');buffer.fill(0);resolve();
}));
fs.closeSync(fd);
const handle=await open('tokens.txt','r');
const last=await handle.read(Buffer.alloc(1),undefined,1,6);assert.equal(last.buffer.toString(),'g');
const first=await handle.read({buffer:Buffer.alloc(2)});
assert.equal(first.buffer.toString(),'ab');first.buffer.fill(0);
const second=await handle.readv([Buffer.alloc(1),Buffer.alloc(2)]);
assert.equal(second.bytesRead,3);assert.equal(Buffer.concat(second.buffers).toString(),'cde');
for(const buffer of second.buffers)buffer.fill(0);
assert.equal(await handle.readFile('utf8'),'fg');await handle.close();
fs.writeFileSync('tokens.txt','replacement');
result.messages.push({type:'dependency',file:'tokens.txt'});
root.append({prop:'range',value:'done'});
}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({ sourceRoot: base, repositoryRoots: [], text: "a{}" }),
  );
  const reads = result.readEvidence.reads.filter(
    (read) => read.path === target,
  );
  for (const [offset, bytes, eof] of [
    [1, "bc", false],
    [6, "g", false],
    [3, "def", false],
    [0, "ab", false],
    [2, "cde", false],
    [5, "fg", true],
  ] as const)
    assert.ok(
      reads.some(
        (read) =>
          read.kind === "byte-range" &&
          isDeepStrictEqual(
            {
              kind: read.kind,
              path: read.path,
              digest: read.digest,
              offset: read.offset,
              length: read.length,
              eof: read.eof,
            },
            {
              kind: "byte-range",
              path: target,
              digest: createHash("sha256").update(bytes).digest("hex"),
              offset,
              length: Buffer.byteLength(bytes),
              eof,
            },
          ),
      ),
      `missing range ${offset}: ${bytes}: ${JSON.stringify(reads)}`,
    );
  assert.equal(result.readEvidence.coverage, "incomplete");
});

test("PostCSS tracks reused descriptors and whole reads from the current position", async (context) => {
  const { base } = await sidecarSources(context);
  await fs.writeFile(path.join(base, "first.txt"), "first");
  await fs.writeFile(path.join(base, "second.txt"), "second");
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {open,readFile} from 'node:fs/promises';
const callbackOpen=file=>new Promise((resolve,reject)=>fs.open(file,'r',(error,fd)=>error?reject(error):resolve(fd)));
export default {plugins:[{postcssPlugin:'reuse',async Once(root,{result}){
let fd=await callbackOpen('first.txt');
await new Promise((resolve,reject)=>fs.readv(fd,[Buffer.alloc(2)],(error,count,buffers)=>{
if(error)return reject(error);assert.equal(count,2);assert.equal(buffers[0].toString(),'fi');resolve();
}));
assert.equal(fs.readFileSync(fd,'utf8'),'rst');fs.closeSync(fd);
fd=await callbackOpen('second.txt');
assert.equal(fs.readSync(fd,Buffer.alloc(2)),2);
const rest=await new Promise((resolve,reject)=>fs.readFile(fd,'utf8',(error,text)=>error?reject(error):resolve(text)));
assert.equal(rest,'cond');fs.closeSync(fd);
const handle=await open('first.txt','r');
await handle.read(Buffer.alloc(1));
assert.equal(await readFile(handle,'utf8'),'irst');await handle.close();
for(const file of ['first.txt','second.txt'])result.messages.push({type:'dependency',file});
root.append({prop:'reuse',value:'done'});
}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({ sourceRoot: base, repositoryRoots: [], text: "a{}" }),
  );
  for (const [file, offset, bytes] of [
    ["first.txt", 2, "rst"],
    ["second.txt", 2, "cond"],
    ["first.txt", 1, "irst"],
  ] as const) {
    assert.ok(
      result.readEvidence.reads.some(
        (read) =>
          read.kind === "byte-range" &&
          read.path === path.join(base, file) &&
          read.offset === offset &&
          read.length === bytes.length &&
          read.digest === createHash("sha256").update(bytes).digest("hex"),
      ),
      `missing remaining bytes for ${file} at ${offset}`,
    );
  }
});

test("a descriptor shared with an opaque helper keeps its later implicit offset unknown", async (context) => {
  const { base } = await sidecarSources(context);
  const file = path.join(base, "shared.txt");
  await fs.writeFile(file, "abcdef");
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
export default {plugins:[{postcssPlugin:'shared',Once(root,{result}){
const fd=fs.openSync('shared.txt','r');
execFileSync(process.execPath,['-e',"require('node:fs').readSync(3,Buffer.alloc(2),0,2,null)"],{stdio:['ignore','pipe','pipe',fd]});
const bytes=Buffer.alloc(2);fs.readSync(fd,bytes,0,2,null);fs.closeSync(fd);
root.append({prop:'value',value:bytes.toString()});result.messages.push({type:'dependency',file:'shared.txt'});
}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({ sourceRoot: base, repositoryRoots: [], text: "a{}" }),
  );
  assert.match(result.text, /value: cd/u);
  assert.deepEqual(
    result.readEvidence.reads.filter((read) => read.path === file),
    [],
  );
  assert.equal(result.readEvidence.coverage, "incomplete");
});

test("a worker can share a numeric descriptor without a FileHandle transfer", async (context) => {
  const { base } = await sidecarSources(context);
  const file = path.join(base, "worker.txt");
  await fs.writeFile(file, "abcdef");
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
export default {plugins:[{postcssPlugin:'worker',async Once(root,{result}){
const fd=fs.openSync('worker.txt','r');
await new Promise((resolve,reject)=>new Worker("require('node:fs').readSync(require('node:worker_threads').workerData,Buffer.alloc(2),0,2,null)",{eval:true,workerData:fd}).once('error',reject).once('exit',code=>code===0?resolve():reject(new Error('worker failed'))));
const bytes=Buffer.alloc(2);fs.readSync(fd,bytes,0,2,null);fs.closeSync(fd);
root.append({prop:'value',value:bytes.toString()});result.messages.push({type:'dependency',file:'worker.txt'});
}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({ sourceRoot: base, repositoryRoots: [], text: "a{}" }),
  );
  assert.match(result.text, /value: cd/u);
  assert.deepEqual(
    result.readEvidence.reads.filter((read) => read.path === file),
    [],
  );
  assert.equal(result.readEvidence.coverage, "incomplete");
});

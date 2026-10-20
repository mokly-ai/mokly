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
      reads.some((read) =>
        isDeepStrictEqual(read, {
          kind: "byte-range",
          path: target,
          digest: createHash("sha256").update(bytes).digest("hex"),
          offset,
          length: Buffer.byteLength(bytes),
          eof,
        }),
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

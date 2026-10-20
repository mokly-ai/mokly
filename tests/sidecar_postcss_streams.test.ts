import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

for (const kind of ["path", "handle"])
  test(`PostCSS records raw ${kind} stream chunks with inclusive range bounds`, async (context) => {
    const { base } = await sidecarSources(context);
    const file = path.join(base, "stream.bin");
    const bytes = Buffer.from([0, 0xff, 0xfe, 65, 66, 0, 70, 71]);
    await fs.writeFile(file, bytes);
    await fs.writeFile(
      path.join(base, "postcss.mjs"),
      `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {open} from 'node:fs/promises';
export default {plugins:[{postcssPlugin:'stream',async Once(root,{result}){
const options={start:1,end:6,highWaterMark:2,encoding:'latin1'};
${kind === "handle" ? "const handle=await open('stream.bin','r');const stream=handle.createReadStream(options);" : "const stream=fs.createReadStream('stream.bin',options);"}
let text='';for await(const chunk of stream)text+=chunk;
assert.equal(Buffer.from(text,'latin1').toString('hex'),'fffe41420046');
fs.writeFileSync('stream.bin','replacement');
result.messages.push({type:'dependency',file:'stream.bin'});
root.append({prop:'stream',value:'read'});
}}]};`,
    );
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    const result = await sidecar.call<CssResult>(
      "processCss",
      cssParams({ sourceRoot: base, repositoryRoots: [], text: "a{}" }),
    );
    const ranges = result.readEvidence.reads.filter(
      (read) => read.path === file,
    );
    for (const offset of [1, 3, 5])
      assert.ok(
        ranges.some(
          (read) =>
            read.kind === "byte-range" &&
            read.offset === offset &&
            read.length === 2 &&
            read.digest ===
              createHash("sha256")
                .update(bytes.subarray(offset, offset + 2))
                .digest("hex"),
        ),
        `missing raw stream chunk ${offset}`,
      );
    assert.equal(result.readEvidence.coverage, "incomplete");
  });

test("PostCSS ignores invented stream bytes and preserves an explicit opaque dependency", async (context) => {
  const { base } = await sidecarSources(context);
  const file = path.join(base, "opaque.txt");
  await fs.writeFile(file, "disk");
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
import fs from 'node:fs';
let sent=false;
const provider={open:fs.open,close:fs.close,read(fd,buffer,offset,length,position,done){
const count=sent?0:buffer.write('synthetic',offset);sent=true;queueMicrotask(()=>done(null,count,buffer));
}};
export default {plugins:[{postcssPlugin:'opaque-stream',async Once(root,{result}){
let text='';for await(const chunk of fs.createReadStream('opaque.txt',{fs:provider}))text+=chunk;
root.append({prop:'value',value:text});result.messages.push({type:'dependency',file:'opaque.txt'});
}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({ sourceRoot: base, repositoryRoots: [], text: "a{}" }),
  );
  assert.match(result.text, /synthetic/u);
  assert.equal(result.readEvidence.coverage, "incomplete");
  assert.deepEqual(
    result.readEvidence.reads.filter((read) => read.path === file),
    [],
  );
  assert.ok(
    result.dependencies.some((dependency) => dependency.path === "opaque.txt"),
  );
});

test("PostCSS keeps FileHandle web stream BYOB chunks and end-of-file evidence", async (context) => {
  const { base } = await sidecarSources(context);
  const file = path.join(base, "web.txt");
  await fs.writeFile(file, "web-data");
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {open} from 'node:fs/promises';
export default {plugins:[{postcssPlugin:'web',async Once(root,{result}){
const handle=await open('web.txt','r');
const stream=handle.readableWebStream();
const reader=stream.getReader({mode:'byob'});
let text='';while(true){const {value,done}=await reader.read(new Uint8Array(2));if(done)break;text+=Buffer.from(value).toString();}
reader.releaseLock();assert.equal(text,'web-data');await handle.close();
fs.writeFileSync('web.txt','web-data-added');
result.messages.push({type:'dependency',file:'web.txt'});root.append({prop:'web',value:text});
}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({ sourceRoot: base, repositoryRoots: [], text: "a{}" }),
  );
  const ranges = result.readEvidence.reads
    .filter((read) => read.kind === "byte-range")
    .filter((read) => read.path === file);
  for (const offset of [0, 2, 4, 6])
    assert.ok(
      ranges.some(
        (read) =>
          read.offset === offset &&
          read.length === 2 &&
          read.digest ===
            createHash("sha256")
              .update("web-data".slice(offset, offset + 2))
              .digest("hex"),
      ),
    );
  assert.ok(
    ranges.some((read) => read.offset === 8 && read.length === 0 && read.eof),
  );
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

test("promisified descriptor APIs retain named results and read evidence", async (context) => {
  const { base } = await sidecarSources(context);
  const target = path.join(base, "tokens.txt");
  await fs.writeFile(target, "abcdef");
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {promisify} from 'node:util';
export default {plugins:[{postcssPlugin:'promisified',async Once(root,{result}){
const fd=await promisify(fs.open)('tokens.txt','r+');
const first=await promisify(fs.read)(fd,Buffer.alloc(1),0,1,0);
assert.equal(first.bytesRead,1);assert.equal(first.buffer.toString(),'a');
const second=await promisify(fs.readv)(fd,[Buffer.alloc(1)],1);
assert.equal(second.bytesRead,1);assert.equal(second.buffers[0].toString(),'b');
const scalar=await promisify(fs.write)(fd,Buffer.from('a'),0,1,0);
assert.equal(scalar.bytesWritten,1);assert.equal(scalar.buffer.toString(),'a');
const vector=await promisify(fs.writev)(fd,[Buffer.from('b')],1);
assert.equal(vector.bytesWritten,1);assert.equal(vector.buffer[0].toString(),'b');
await promisify(fs.close)(fd);
root.append({prop:'value',value:first.buffer.toString()+second.buffers[0].toString()});
result.messages.push({type:'dependency',file:'tokens.txt'});
}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({ sourceRoot: base, repositoryRoots: [], text: "a{}" }),
  );
  assert.match(result.text, /value: ab/u);
  const reads = result.readEvidence.reads.filter(
    (read) => read.path === target,
  );
  for (const [offset, bytes] of [
    [0, "a"],
    [1, "b"],
  ] as const)
    assert.ok(
      reads.some(
        (read) =>
          read.kind === "byte-range" &&
          read.offset === offset &&
          read.digest === createHash("sha256").update(bytes).digest("hex"),
      ),
    );
  assert.equal(result.readEvidence.coverage, "incomplete");
  assert.equal(await fs.readFile(target, "utf8"), "abcdef");
});

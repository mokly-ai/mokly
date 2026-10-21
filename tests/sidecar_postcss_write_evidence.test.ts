import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

for (const operation of ["writeFile", "appendFile"])
  test(`promise ${operation} invalidates the FileHandle cursor before later reads`, async (context) => {
    const base = await publicationFixture();
    context.after(() => fs.rm(base, { recursive: true, force: true }));
    const target = path.join(base, "tokens.txt");
    await fs.writeFile(target, "abcdef");
    await fs.writeFile(path.join(base, "theme.css"), "a{color:black}");
    await fs.writeFile(
      path.join(base, "mokly.config.json"),
      JSON.stringify({
        postcss: "postcss.mjs",
        stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
      }),
    );
    await fs.writeFile(
      path.join(base, "postcss.mjs"),
      `
import assert from 'node:assert/strict';
import {open,${operation}} from 'node:fs/promises';
export default {plugins:[{postcssPlugin:'write-cursor',async Once(root,{result}){
const handle=await open('tokens.txt','r+');
assert.equal(await ${operation}(handle,'ab'),undefined);
const {buffer}=await handle.read(Buffer.alloc(1));
assert.equal(buffer.toString(),'c');
root.walkDecls('color',decl=>decl.value=buffer.toString());
const explicit=await handle.read(Buffer.alloc(1),0,1,4);
assert.equal(explicit.buffer.toString(),'e');
await handle.close();
result.messages.push({type:'dependency',file:'tokens.txt'});
}}]};`,
    );
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    const result = await sidecar.call<CssResult>(
      "processCss",
      cssParams({
        sourceRoot: base,
        repositoryRoots: [],
        text: "a{color:black}",
      }),
    );
    assert.match(result.text, /color:c/u);
    const reads = result.readEvidence.reads.filter(
      (read) => read.path === target,
    );
    assert.equal(reads.length, 1, JSON.stringify(reads));
    assert.equal(reads[0]?.kind, "byte-range");
    assert.ok(
      reads.some(
        (read) =>
          read.kind === "byte-range" &&
          read.offset === 4 &&
          read.digest === createHash("sha256").update("e").digest("hex"),
      ),
    );
    assert.equal(result.readEvidence.coverage, "incomplete");
    await sidecar.call("shutdown");
    assert.equal(await fs.readFile(target, "utf8"), "abcdef");
    const build = await command(
      base,
      "build",
      ["--no-changes", "--out=.context/site"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(build.code, 0, build.stderr);
  });

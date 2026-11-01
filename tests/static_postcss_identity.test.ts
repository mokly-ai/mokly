import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { write } from "./helpers/static_changes.js";
import { files } from "./helpers/static_faults.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

for (const reader of [
  "sync",
  "callback",
  "promise",
  "descriptor",
  "handle",
  "callback-rs",
  "promise-rplus",
] as const)
  test(`PostCSS ${reader} reads retain identity before a same-byte symlink retarget`, async (context) => {
    const root = await publicationFixture();
    try {
      await write(root, "a.txt", "red");
      await write(root, "b.txt", "red");
      await fs.symlink("a.txt", path.join(root, "tokens.txt"), "file");
      await write(root, "theme.css", "a{color:black}");
      await write(
        root,
        "mokly.config.json",
        JSON.stringify({
          postcss: "postcss.mjs",
          stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
        }),
      );
      const read = {
        sync: "const value=fs.readFileSync('tokens.txt','utf8');",
        callback:
          "const value=await new Promise((resolve,reject)=>fs.readFile('tokens.txt','utf8',(error,bytes)=>error?reject(error):resolve(bytes)));",
        promise: "const value=await readFile('tokens.txt','utf8');",
        "callback-rs":
          "const value=await new Promise((resolve,reject)=>fs.readFile('tokens.txt',{encoding:'utf8',flag:'rs'},(error,bytes)=>error?reject(error):resolve(bytes)));",
        "promise-rplus":
          "const value=await readFile('tokens.txt',{encoding:'utf8',flag:'r+'});",
        descriptor:
          "const fd=fs.openSync('tokens.txt','r');const bytes=Buffer.alloc(3);fs.readSync(fd,bytes,0,3,0);fs.closeSync(fd);const value=bytes.toString();",
        handle:
          "const handle=await open('tokens.txt','r');const value=await handle.readFile('utf8');await handle.close();",
      }[reader];
      await write(
        root,
        "postcss.mjs",
        `
import fs from 'node:fs';
import {open,readFile} from 'node:fs/promises';
export default {plugins:[{postcssPlugin:'identity',async Once(root,{result}){
${read}
root.walkDecls('color',declaration=>{declaration.value=value});
if(process.env.FIXTURE_RETARGET){fs.unlinkSync('tokens.txt');fs.symlinkSync('b.txt','tokens.txt','file');}
result.messages.push({type:'dependency',file:'tokens.txt'});
}}]};`,
      );
      const args = ["--no-changes", "--out=.context/site"];
      const stable = await command(root, "build", args).result;
      assert.equal(stable.code, 0, stable.stderr);
      const previous = await files(path.join(root, ".context/site"));
      const changed = await command(
        root,
        "build",
        args,
        "plain",
        { FIXTURE_RETARGET: "1" },
        context.signal,
      ).result;
      assert.equal(changed.code, 1, changed.stderr);
      assert.match(
        changed.stderr,
        /\[mokly\/export-invalid\] Inputs changed during the build:.*tokens\.txt/u,
      );
      assert.deepEqual(await files(path.join(root, ".context/site")), previous);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

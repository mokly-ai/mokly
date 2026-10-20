import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { write } from "./helpers/static_changes.js";
import { files } from "./helpers/static_faults.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

for (const reader of ["descriptor", "handle"])
  test(`static build rejects a changed ${reader} range before installation`, async (context) => {
    const root = await publicationFixture();
    try {
      await write(root, "tokens.txt", "red-unused");
      await write(root, "theme.css", "a{color:black}");
      await write(
        root,
        "mokly.config.json",
        JSON.stringify({
          postcss: "postcss.mjs",
          stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
        }),
      );
      await write(
        root,
        "postcss.mjs",
        `
import fs from 'node:fs';
import {open} from 'node:fs/promises';
export default {plugins:[{postcssPlugin:'range',async Once(root,{result}){
const buffer=Buffer.alloc(3);
${reader === "handle" ? "const handle=await open('tokens.txt','r'); await handle.read(buffer,0,3,0); await handle.close();" : "const fd=fs.openSync('tokens.txt','r'); fs.readSync(fd,buffer,0,3,0); fs.closeSync(fd);"}
root.walkDecls('color',declaration=>{declaration.value=buffer.toString()});
if(process.env.MOKLY_TEST_RANGE_EDIT)fs.writeFileSync('tokens.txt','tan-unused');
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
        { MOKLY_TEST_RANGE_EDIT: "1" },
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

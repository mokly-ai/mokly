import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";

import { files } from "./helpers/static_faults.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

const build = (root: string) =>
  command(root, "build", [
    "--no-changes",
    "--sidecars=1",
    "--out=.context/site",
  ]).result;

test(
  "PostCSS consumed bytes reject an edit before capture and preserve owned output",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture(true);
    let edited = false;
    const barrier = net.createServer((socket) => {
      socket.once("data", () => {
        void fs.writeFile(path.join(root, "tokens.txt"), "blue").then(
          () => {
            edited = true;
            socket.end("continue");
          },
          (error: Error) => socket.destroy(error),
        );
      });
    });
    await new Promise<void>((resolve) =>
      barrier.listen(0, "127.0.0.1", resolve),
    );
    const address = barrier.address();
    assert.ok(address && typeof address === "object");
    try {
      await fs.mkdir(path.join(root, ".context"), { recursive: true });
      await fs.writeFile(path.join(root, "tokens.txt"), "red");
      await fs.writeFile(path.join(root, "theme.css"), "a { color: black }");
      await fs.writeFile(
        path.join(root, "mokly.config.json"),
        JSON.stringify({
          postcss: "postcss.mjs",
          stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
        }),
      );
      await fs.writeFile(
        path.join(root, "specs/home.mockup.ts"),
        `
import fs from 'node:fs';
import {definePage} from '@mokly/mokly';
export default definePage({title:'Home',description:'',relatedDocs:[],render(){
fs.writeFileSync('.context/rendered', 'yes');
return '<!doctype html><html><head><title>Home</title></head><body>Home</body></html>';
}});`,
      );
      await fs.writeFile(
        path.join(root, "postcss.mjs"),
        `
import fs from 'node:fs';
import net from 'node:net';
export default {plugins:[{postcssPlugin:'tokens',async Once(root,{result}){
const value=fs.readFileSync('tokens.txt','utf8');
if(fs.existsSync('.context/edit')) await new Promise((resolve,reject)=>{
const socket=net.connect(${address.port},'127.0.0.1',()=>socket.write('read'));
socket.once('data',()=>resolve()); socket.once('error',reject);
});
root.walkDecls('color', declaration => { declaration.value=value });
result.messages.push({type:'dependency',plugin:'tokens',file:'tokens.txt'});
}}]};`,
      );
      const initial = await build(root);
      assert.equal(initial.code, 0, initial.stderr);
      const previous = await files(path.join(root, ".context/site"));
      await fs.rm(path.join(root, ".context/rendered"));
      await fs.writeFile(path.join(root, ".context/edit"), "yes");
      const result = await build(root);
      assert.equal(edited, true);
      assert.equal(
        await fs.readFile(path.join(root, "tokens.txt"), "utf8"),
        "blue",
      );
      assert.equal(result.code, 1, result.stderr);
      assert.match(
        result.stderr,
        /\[mokly\/export-invalid\] Inputs changed during the build:.*tokens\.txt/u,
      );
      await assert.rejects(fs.stat(path.join(root, ".context/rendered")), {
        code: "ENOENT",
      });
      assert.deepEqual(await files(path.join(root, ".context/site")), previous);
    } finally {
      await new Promise<void>((resolve, reject) =>
        barrier.close((error) => (error ? reject(error) : resolve())),
      );
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "opaque PostCSS reads keep their late baseline and still detect later edits",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture(true);
    try {
      await fs.mkdir(path.join(root, ".context"), { recursive: true });
      await fs.writeFile(path.join(root, "tokens.txt"), "red");
      await fs.writeFile(path.join(root, "theme.css"), "a { color: black }");
      await fs.writeFile(
        path.join(root, "mokly.config.json"),
        JSON.stringify({
          postcss: "postcss.mjs",
          stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
        }),
      );
      await fs.writeFile(
        path.join(root, "postcss.mjs"),
        `
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
export default {plugins:[{postcssPlugin:'opaque',Once(root,{result}){
const value=execFileSync(process.execPath,['-e',"process.stdout.write(require('node:fs').readFileSync('tokens.txt'))"],{encoding:'utf8'});
fs.writeFileSync('tokens.txt','blue');
root.walkDecls('color',declaration=>{declaration.value=value});
result.messages.push({type:'dependency',file:'tokens.txt'});
}}]};`,
      );
      await fs.writeFile(
        path.join(root, "specs/home.mockup.ts"),
        `
import fs from 'node:fs';
import {definePage} from '@mokly/mokly';
export default definePage({title:'Home',description:'',relatedDocs:[],render(){
if(fs.existsSync('.context/edit'))fs.writeFileSync('tokens.txt','green');
return '<!doctype html><html><head><title>Home</title></head><body>Home</body></html>';
}});`,
      );
      const first = await build(root);
      assert.equal(first.code, 0, first.stderr);
      assert.equal(
        await fs.readFile(path.join(root, "tokens.txt"), "utf8"),
        "blue",
      );
      const previous = await files(path.join(root, ".context/site"));
      assert.ok(
        [...previous].some(
          ([name, bytes]) =>
            name.endsWith("theme.css") && /color:\s*red/.test(bytes.toString()),
        ),
      );
      await fs.writeFile(path.join(root, ".context/edit"), "yes");
      const next = await build(root);
      assert.equal(next.code, 1, next.stderr);
      assert.match(
        next.stderr,
        /\[mokly\/export-invalid\] Inputs changed during the build:.*tokens\.txt/u,
      );
      assert.deepEqual(await files(path.join(root, ".context/site")), previous);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

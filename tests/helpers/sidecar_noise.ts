import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { consumer } from "./mokly_serve.js";
import { workspace } from "./static_publication.js";

/** CLI output is acknowledged before shutdown; direct runs retain the EOF tail. */
export async function noisyFixture(
  context: TestContext,
  verb: "build" | "serve",
  acknowledge: boolean,
) {
  const root = await consumer(context, {
    "mokly.config.json":
      '{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}',
    "specs/home.screen.html": "---\ntitle: Home\n---\n<p>Home</p>",
    "theme.css": "p { color: red }",
    "postcss.mjs":
      "import fs from 'node:fs';fs.appendFileSync('.context/pids',process.pid+'\\n');export default {plugins:[]};",
  });
  const packageRoot = path.join(root, ".context/package");
  await fs.mkdir(path.join(packageRoot, "dist"), { recursive: true });
  await fs.writeFile(
    path.join(packageRoot, "package.json"),
    '{"type":"module"}',
  );
  const module = (file: string) =>
    pathToFileURL(path.join(workspace, "packages/mokly/dist", file)).href;
  await fs.writeFile(
    path.join(packageRoot, "dist/sidecar.js"),
    `
import fs from 'node:fs';
import {Session} from ${JSON.stringify(module("sidecar/session.js"))};
fs.appendFileSync('.context/pids',process.pid+'\\n');
process.on('exit',code=>fs.writeFileSync('.context/sidecar-exit',String(code)));
const original=Session.prototype.call;
let written=false;
let tailed=false;
const acknowledged=${JSON.stringify(acknowledge)};
const tail=async()=>{
  tailed=true;
  await write('\\n'+'S'.repeat(65537)+'\\n');
  await write('T'.repeat(17));
  fs.writeFileSync('.context/stderr-tail-complete','yes');
};
const write=text=>new Promise((resolve,reject)=>process.stderr.write(text,error=>error?reject(error):resolve()));
Session.prototype.call=async function(request){
  if(!written && request.method==='processCss'){
    written=true;
    const forwarded=acknowledged ? new Promise((resolve,reject)=>{
      const watcher=fs.watch('.context',()=>{
        if(fs.existsSync('.context/stderr-forwarded')){watcher.close();resolve();}
      });
      watcher.on('error',reject);
    }) : null;
    for(let index=0;index<40;index++) await write('L'.repeat(65537)+'\\n');
    await write('R'.repeat(2*1024*1024+1));
    fs.writeFileSync('.context/stderr-complete','yes');
    if(acknowledged){
      if(${JSON.stringify(verb === "serve")}) await tail();
      await write('\\n');
      await forwarded;
    }
  }
  if(${JSON.stringify(verb === "serve")} && !tailed && request.method==='shutdown'){
    await tail();
  }
  return original.call(this,request);
};
await import(${JSON.stringify(module("sidecar.js"))});
`,
  );
  return { root, packageRoot };
}

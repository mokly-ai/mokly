import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";
import { write } from "./helpers/static_changes.js";
import { files } from "./helpers/static_faults.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

/** Each reader reads the file named `FILE`; the plugin binds its value. */
const reads = {
  sync: "const value=fs.readFileSync(FILE,'utf8');",
  callback:
    "const value=await new Promise((resolve,reject)=>fs.readFile(FILE,'utf8',(error,bytes)=>error?reject(error):resolve(bytes)));",
  promise: "const value=await readFile(FILE,'utf8');",
  "callback-rs":
    "const value=await new Promise((resolve,reject)=>fs.readFile(FILE,{encoding:'utf8',flag:'rs'},(error,bytes)=>error?reject(error):resolve(bytes)));",
  "promise-rplus":
    "const value=await readFile(FILE,{encoding:'utf8',flag:'r+'});",
  descriptor:
    "const fd=fs.openSync(FILE,'r');const bytes=Buffer.alloc(3);fs.readSync(fd,bytes,0,3,0);fs.closeSync(fd);const value=bytes.toString();",
  handle:
    "const handle=await open(FILE,'r');const value=await handle.readFile('utf8');await handle.close();",
} as const;
type Reader = keyof typeof reads;

const retarget = (file: string, target: string) =>
  `fs.unlinkSync('${file}');fs.symlinkSync('${target}','${file}','file');`;

function plugin(body: string): string {
  return `
import fs from 'node:fs';
import {open,readFile} from 'node:fs/promises';
export default {plugins:[{postcssPlugin:'identity',async Once(root,{result}){
${body}
}}]};`;
}

test("PostCSS readers retain the opened identity before a same-byte symlink retarget", async (context) => {
  const { base } = await sidecarSources(context);
  const readers = Object.keys(reads) as Reader[];
  const body: string[] = [];
  for (const reader of readers) {
    await fs.writeFile(path.join(base, `${reader}-a.txt`), "red");
    await fs.writeFile(path.join(base, `${reader}-b.txt`), "red");
    await fs.symlink(
      `${reader}-a.txt`,
      path.join(base, `${reader}.txt`),
      "file",
    );
    body.push(
      `{${reads[reader].replaceAll("FILE", `'${reader}.txt'`)}`,
      `root.append({prop:'${reader}',value});`,
      `${retarget(`${reader}.txt`, `${reader}-b.txt`)}}`,
      `result.messages.push({type:'dependency',file:'${reader}.txt'});`,
    );
  }
  await fs.writeFile(path.join(base, "postcss.mjs"), plugin(body.join("\n")));
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>(
    "processCss",
    cssParams({ sourceRoot: base, repositoryRoots: [], text: "a{}" }),
  );
  for (const reader of readers)
    assert.match(result.text, new RegExp(`${reader}: red`, "u"), reader);
  const digest = createHash("sha256").update("red").digest("hex");
  for (const reader of readers) {
    const opened = path.join(base, `${reader}-a.txt`);
    const stat = await fs.stat(opened, { bigint: true });
    const identity = {
      canonical: await fs.realpath(opened),
      object: `${stat.dev}:${stat.ino}`,
    };
    const file = path.join(base, `${reader}.txt`);
    const range = { offset: 0, length: 3 };
    const expected =
      reader === "descriptor"
        ? { kind: "byte-range", ...range, eof: false }
        : reader === "handle"
          ? { kind: "byte-range", ...range, eof: true }
          : { kind: "whole-file" };
    assert.deepEqual(
      result.readEvidence.reads.filter((read) => read.path === file),
      [{ ...expected, path: file, digest, identity }],
      reader,
    );
  }
});

/** One whole-file and one byte-range reader keep the end-to-end rejection. */
for (const reader of ["sync", "descriptor"] as const)
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
      await write(
        root,
        "postcss.mjs",
        plugin(`${reads[reader].replaceAll("FILE", "'tokens.txt'")}
root.walkDecls('color',declaration=>{declaration.value=value});
if(process.env.FIXTURE_RETARGET){${retarget("tokens.txt", "b.txt")}}
result.messages.push({type:'dependency',file:'tokens.txt'});`),
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

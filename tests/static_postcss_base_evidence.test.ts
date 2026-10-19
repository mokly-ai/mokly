import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { files } from "./helpers/static_faults.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

const exec = promisify(execFile);

test(
  "base PostCSS witnesses are checked against pinned Git bytes without using head baselines",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
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
export default {plugins:[{postcssPlugin:'base',Once(root,{result}){
if(!fs.existsSync('.git')) fs.writeFileSync('tokens.txt','blue');
const value=fs.readFileSync('tokens.txt','utf8');
root.walkDecls('color',declaration=>{declaration.value=value});
result.messages.push({type:'dependency',file:'tokens.txt'});
}}]};`,
      );
      for (const args of [
        ["add", "."],
        ["commit", "-qm", "postcss fixture"],
      ])
        await exec("git", args, { cwd: root });
      const first = await command(root, "build", [
        "--no-changes",
        "--out=.context/site",
      ]).result;
      assert.equal(first.code, 0, first.stderr);
      const previous = await files(path.join(root, ".context/site"));
      await fs.writeFile(
        path.join(root, "specs/home.screen.html"),
        "---\ntitle: Home\n---\n<h1>New head</h1>",
      );
      const result = await command(root, "build", [
        "--base=HEAD",
        "--sidecars=1",
        "--out=.context/site",
      ]).result;
      assert.equal(
        await fs.readFile(path.join(root, "tokens.txt"), "utf8"),
        "red",
      );
      assert.equal(result.code, 1, result.stderr);
      assert.match(
        result.stderr,
        /\[mokly\/export-invalid\] Inputs changed during the build:.*tokens\.txt/u,
      );
      assert.deepEqual(await files(path.join(root, ".context/site")), previous);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

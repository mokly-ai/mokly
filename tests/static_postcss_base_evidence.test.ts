import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { dependency } from "./helpers/sidecar_sources.js";
import { git, write } from "./helpers/static_changes.js";
import { files } from "./helpers/static_faults.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

const exec = promisify(execFile);

for (const reader of ["whole", "range"])
  test(
    `base PostCSS ${reader} witnesses are checked against pinned Git bytes without using head baselines`,
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
${reader === "whole" ? "const value=fs.readFileSync('tokens.txt','utf8');" : "const fd=fs.openSync('tokens.txt','r');const bytes=Buffer.alloc(3);fs.readSync(fd,bytes,0,3,0);fs.closeSync(fd);const value=bytes.toString();"}
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
        assert.deepEqual(
          await files(path.join(root, ".context/site")),
          previous,
        );
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    },
  );

test(
  "base PostCSS package witnesses reject changes before document callbacks",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture(true);
    try {
      const marker = path.join(root, ".context/base-callback");
      await fs.mkdir(path.dirname(marker));
      await write(root, ".deps/package.json", "{}");
      const plugin = await dependency(
        path.join(root, ".deps"),
        "probe",
        `
import fs from 'node:fs';
import value from './value.mjs';
export default ()=>({postcssPlugin:'probe',Once(root){
if(process.env.MOKLY_TEST_POSTCSS_BASE_EDIT && !fs.existsSync('.git'))
  fs.writeFileSync(new URL('./value.mjs',import.meta.url),"export default 'blue';");
root.walkDecls('color',declaration=>{declaration.value=value});
}});`,
      );
      await write(plugin, "value.mjs", "export default 'red';");
      await write(root, "theme.css", "a { color: black }");
      await write(root, "postcss.mjs", "export default {plugins:{probe:{}}};");
      await write(
        root,
        "mokly.config.json",
        JSON.stringify({
          postcss: "postcss.mjs",
          stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
          moduleResolution: { packageRoots: [".deps"] },
        }),
      );
      await write(
        root,
        "specs/home.mockup.ts",
        `
import fs from 'node:fs';
import {definePage} from '@mokly/mokly';
export default definePage({title:'Home',description:'',relatedDocs:[],render(){
if(!fs.existsSync('.git')) fs.writeFileSync(${JSON.stringify(marker)},'ran');
return '<!doctype html><html><head><title>Home</title></head><body>Home</body></html>';
}});`,
      );
      await git(root, "add", ".");
      await git(root, "commit", "-qm", "base package witness");
      const args = ["--base=HEAD", "--sidecars=1", "--out=.context/site"];
      const stable = await command(root, "build", args).result;
      assert.equal(stable.code, 0, stable.stderr);
      assert.equal(await fs.readFile(marker, "utf8"), "ran");
      await fs.rm(marker);
      const previous = await files(path.join(root, ".context/site"));
      const result = await command(
        root,
        "build",
        args,
        "plain",
        { MOKLY_TEST_POSTCSS_BASE_EDIT: "1" },
        context.signal,
      ).result;
      assert.equal(result.code, 1, result.stderr);
      assert.match(
        result.stderr,
        /\[mokly\/export-invalid\] Inputs changed during the build:.*value\.mjs/u,
      );
      assert.equal(
        await fs.readFile(path.join(plugin, "value.mjs"), "utf8"),
        "export default 'blue';",
      );
      assert.deepEqual(await files(path.join(root, ".context/site")), previous);
      await assert.rejects(fs.access(marker), { code: "ENOENT" });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

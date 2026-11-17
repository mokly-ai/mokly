import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { scratchDirectory } from "../../_tests_/scratch.mjs";

import { catalogueIndex } from "./helpers/catalogue-index.js";

const repository = path.resolve(import.meta.dirname, "../../..");
const execute = promisify(execFile);
const files = [
  "scripts/stage.mjs",
  "scripts/stage/catalogue.ts",
  "scripts/stage/tree.ts",
  "scripts/stage/fragments.ts",
  "src/stage.ts",
  "src/workspace.ts",
];

async function fixture() {
  const root = scratchDirectory(
    path.join(repository, ".context", "site-source-"),
  );
  const write = async (file: string, data: string) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), data);
  };
  for (const file of files)
    await write(
      "apps/site/" + file,
      await readFile(path.join(repository, "apps/site", file), "utf8"),
    );
  await write("apps/site/astro.config.mjs", "export default {};\n");
  await write("apps/site/package.json", '{"type":"module"}');
  await write(
    "package.json",
    '{"type":"module","private":true,"workspaces":["mockups"]}',
  );
  await write(
    "apps/mockups/package.json",
    '{"name":"@mokly-cloud/mockups","private":true,"scripts":{"mockups:build":"node ../../fixture-build.mjs"}}',
  );
  await symlink(
    path.join(repository, "node_modules"),
    path.join(root, "node_modules"),
    "dir",
  );
  await write(
    "fixture-build.mjs",
    `import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
const root=import.meta.dirname;
const output=path.join(root,'mokly-static/static/mokly-generated');
const directory=path.join(output,'product/account/project-created');
await mkdir(directory,{recursive:true});
for (const view of ['mobile','desktop','mobile.dark','desktop.dark']) await writeFile(path.join(directory,'index.'+view+'.html'),'<html><head><title>Project created</title></head><body><main>Project created</main></body></html>');
const index=path.join(root,'mokly-static/mokly-viewer');
await mkdir(index,{recursive:true});
await writeFile(path.join(index,'index.json'),existsSync(path.join(root,'invalid-build-index'))?'{invalid':JSON.stringify(${JSON.stringify(catalogueIndex())}));
await appendFile(path.join(root,'build-calls'),'build\\n');
`,
  );
  const run = () =>
    execute(process.execPath, ["--import", "tsx", "scripts/stage.mjs"], {
      cwd: path.join(root, "apps/site"),
      timeout: 30_000,
    });
  const build = () =>
    execute(process.execPath, ["fixture-build.mjs"], { cwd: root });
  return {
    root,
    write,
    run,
    build,
    cleanup: () => rm(root, { force: true, recursive: true }),
  };
}

test("site staging automatically builds a missing output tree", async (t) => {
  const current = await fixture();
  t.after(current.cleanup);
  await current.run();
  assert.equal(
    await readFile(path.join(current.root, "build-calls"), "utf8"),
    "build\n",
  );
  const manifest = JSON.parse(
    await readFile(
      path.join(current.root, "apps/site/public/stage/manifest.json"),
      "utf8",
    ),
  );
  assert.equal(manifest.documents.length, 4);
  assert.equal(manifest.screenPath, "product/account/project-created");
});

test("an invalid index with existing documents names the repository-root build", async (t) => {
  const current = await fixture();
  t.after(current.cleanup);
  await current.build();
  for (const value of [
    "{invalid",
    JSON.stringify({ ...catalogueIndex(), schemaVersion: 8 }),
    JSON.stringify({ schemaVersion: 9 }),
  ]) {
    await current.write("mokly-static/mokly-viewer/index.json", value);
    await assert.rejects(
      current.run(),
      (error: Error & { stderr?: string }) => {
        assert.match(
          error.stderr ?? "",
          /The dogfood catalogue needs a version 9 catalogue index\. Run npm run mockups:build from the repository root\./,
        );
        return true;
      },
    );
  }
  assert.equal(
    await readFile(path.join(current.root, "build-calls"), "utf8"),
    "build\n",
  );
});

test("an absent index with existing documents names the root build without rebuilding", async (t) => {
  const current = await fixture();
  t.after(current.cleanup);
  await current.build();
  await rm(path.join(current.root, "mokly-static/mokly-viewer/index.json"));
  await assert.rejects(current.run(), (error: Error & { stderr?: string }) => {
    assert.match(
      error.stderr ?? "",
      /Run npm run mockups:build from the repository root\./,
    );
    return true;
  });
  assert.equal(
    await readFile(path.join(current.root, "build-calls"), "utf8"),
    "build\n",
  );
});

test("an invalid index after the automatic build names the root build", async (t) => {
  const current = await fixture();
  t.after(current.cleanup);
  await current.write("invalid-build-index", "invalid\n");
  await assert.rejects(current.run(), (error: Error & { stderr?: string }) => {
    assert.match(
      error.stderr ?? "",
      /The dogfood catalogue needs a version 9 catalogue index\. Run npm run mockups:build from the repository root\./,
    );
    return true;
  });
  assert.equal(
    await readFile(path.join(current.root, "build-calls"), "utf8"),
    "build\n",
  );
});

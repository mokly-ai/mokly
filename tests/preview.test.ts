import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("preview build snapshots a static Browse catalogue", async (context) => {
  const contextDir = path.join(repositoryRoot, ".context");
  await fs.promises.mkdir(contextDir, { recursive: true });
  const output = await fs.promises.mkdtemp(
    path.join(contextDir, "preview-test-"),
  );
  await fs.promises.rm(output, { recursive: true });
  context.after(() => fs.promises.rm(output, { force: true, recursive: true }));

  await execute(
    process.execPath,
    ["scripts/preview/build.mjs", "--include-changes", "--out", output],
    { cwd: repositoryRoot },
  );
  await execute(
    process.execPath,
    ["scripts/preview/build.mjs", "--include-changes", "--out", output],
    { cwd: repositoryRoot },
  );

  await assertClientGraphIsComplete(output);
  const index = await read(output, "index.html");
  assert.match(index, /<title>Mokly<\/title>/);
  assert.match(index, /data-mokly-filter/);
  assert.match(index, /class="mbk-nav-filter-count">\d+</);
  assert.match(index, /\/__mokly\/client\/react-shell\.js/);
  assert.doesNotMatch(index, /\/__mokly\/client\/browser\.js/);
  assert.match(index, /href="\/view\/screens\/welcome"/);
  assert.doesNotMatch(index, /href="\/view\/screens\/welcome\.html"/);
  const welcome = await read(output, "view/screens/welcome.html");
  assert.match(welcome, /Welcome · Mokly/);
  assert.match(welcome, /data-diff-screen="screens\/welcome.html"/);
  for (const mode of ["current", "side", "overlay", "difference"])
    assert.match(welcome, new RegExp(`data-diff-mode="${mode}"`));
  assert.match(welcome, /data-color-scheme-option="dark"/);
  const frame = welcome.match(
    /<iframe[^>]*data-fragment-light="([^"]+)"[^>]*src="([^"]+)"/,
  );
  assert.ok(frame);
  assert.equal(frame[1], "/static/.generated/screens/welcome.mobile");
  assert.equal(frame[2], frame[1]);
  assert.match(
    welcome,
    /data-fragment-dark="\/static\/\.generated\/screens\/welcome\.mobile\.dark"/,
  );
  assert.match(
    welcome,
    /src="\/static\/\.generated\/screens\/welcome\.desktop"/,
  );
  assert.doesNotMatch(
    welcome,
    /src="\/static\/\.generated\/screens\/welcome\.desktop\.html"/,
  );
  assert.doesNotMatch(welcome, /data-fragment-(?:light|dark)="[^"]+\.html"/);
  assert.match(
    await read(output, "static/.generated/screens/welcome.desktop.html"),
    /Welcome to Mokly/,
  );
  assert.match(
    await read(output, "static/.generated/screens/welcome.desktop.dark.html"),
    /data-color-scheme="dark"/,
  );
  assert.match(await read(output, "__mokly/shell.css"), /--mbk-/);
  assert.ok(
    (
      await fs.promises.stat(
        path.join(output, "__mokly/fonts/InterVariable.woff2"),
      )
    ).size > 0,
  );
  assert.match(await read(output, "404.html"), /Item not found/);
  assert.match(
    await read(output, "_redirects"),
    /\/id\/example-welcome \/view\/screens\/welcome 302/,
  );
  assert.equal(
    await read(output, ".mokly-preview-artifact"),
    "schemaVersion=1\n",
  );
});

test("preview build refuses to replace an unowned directory", async (context) => {
  const contextDir = path.join(repositoryRoot, ".context");
  await fs.promises.mkdir(contextDir, { recursive: true });
  const output = await fs.promises.mkdtemp(
    path.join(contextDir, "preview-unowned-"),
  );
  await fs.promises.writeFile(path.join(output, "keep.txt"), "owned by user\n");
  context.after(() => fs.promises.rm(output, { force: true, recursive: true }));

  await assert.rejects(
    execute(
      process.execPath,
      ["scripts/preview/build.mjs", "--include-changes", "--out", output],
      {
        cwd: repositoryRoot,
      },
    ),
    /refusing to replace unowned preview directory/,
  );
  assert.equal(await read(output, "keep.txt"), "owned by user\n");
});

async function assertClientGraphIsComplete(output: string): Promise<void> {
  const assetRoot = path.join(output, "__mokly");
  const copied = await javascriptFiles(assetRoot);
  assert.ok(copied.length > 0);
  for (const module of copied) {
    const source = await fs.promises.readFile(
      path.join(assetRoot, module),
      "utf8",
    );
    for (const target of relativeImports(source)) {
      const resolved = path.normalize(path.join(path.dirname(module), target));
      assert.ok(
        copied.includes(resolved),
        `${module} imports missing preview module ${resolved}`,
      );
    }
  }
}

async function javascriptFiles(root: string, relative = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.promises.readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    const candidate = path.join(relative, entry.name);
    if (entry.isDirectory())
      files.push(...(await javascriptFiles(root, candidate)));
    else if (entry.isFile() && entry.name.endsWith(".js"))
      files.push(candidate);
  }
  return files;
}

async function read(root: string, relative: string): Promise<string> {
  return await fs.promises.readFile(path.join(root, relative), "utf8");
}

function relativeImports(source: string): string[] {
  const targets: string[] = [];
  const pattern = /(?:^|\s)(?:from|import)\s+"((?:\.\.?\/)[^"]+)"/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1] !== undefined) targets.push(match[1]);
  }
  return targets;
}

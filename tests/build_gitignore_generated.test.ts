import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const exec = promisify(execFile);

async function git(root: string, ...arguments_: string[]): Promise<string> {
  const result = await exec("git", arguments_, { cwd: root });
  return result.stdout;
}

async function committedFixture(context: {
  after(callback: () => Promise<void>): void;
}) {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await git(fixture.root, "init", "-q");
  await fs.writeFile(
    path.join(fixture.entriesDir, "fixture.css"),
    '.x{background:url("../dist/icon.png");src:url("../node_modules/leaflet/dist/font.woff2")}',
  );
  await fs.appendFile(fixture.entryPath, '\nimport "./fixture.css";');
  await fs.mkdir(path.join(fixture.root, "dist"));
  await fs.writeFile(
    path.join(fixture.root, "dist/icon.png"),
    Buffer.from([0, 255]),
  );
  await fs.mkdir(path.join(fixture.root, "node_modules/leaflet/dist"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(fixture.root, "node_modules/leaflet/dist/font.woff2"),
    Buffer.from([255, 0]),
  );
  const config = await loadConfig(fixture.root);
  return { fixture, config, compilation: await compileCatalogue(config) };
}

for (const rules of [
  "node_modules/\ndist/\n",
  "mockups/\n",
  "*.html\nmockups/mokly-generated/mokly-manifest.json\n",
]) {
  test(`Build and untracked Check ignore committability rules ${JSON.stringify(rules)}`, async (context) => {
    const { fixture, config, compilation } = await committedFixture(context);
    await fs.writeFile(path.join(fixture.root, ".gitignore"), rules);
    const store = new FileSystemGeneratedOutputStore();
    await store.write(compilation, config);
    assert.equal(await store.check(compilation, config), "untracked");
    await fs.access(path.join(config.generatedDir, "assets/dist/icon.png"));
    await fs.access(
      path.join(
        config.generatedDir,
        "assets/node_modules/leaflet/dist/font.woff2",
      ),
    );
  });
}

test("Check tracks the complete tree after nested negations and retains tracking after an ignore edit", async (context) => {
  const { fixture, config, compilation } = await committedFixture(context);
  await fs.writeFile(path.join(fixture.mockupsDir, ".gitignore"), "dist/\n");
  const store = new FileSystemGeneratedOutputStore();
  await store.write(compilation, config);
  await fs.appendFile(
    path.join(fixture.mockupsDir, ".gitignore"),
    "!/mokly-generated/**\n",
  );
  await git(fixture.root, "add", "-A");
  assert.equal(await store.check(compilation, config), "tracked");
  await fs.writeFile(path.join(fixture.mockupsDir, ".gitignore"), "dist/\n");
  assert.equal(await store.check(compilation, config), "tracked");
});

test("Build inside a parent Git tree writes without index access", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const store = new FileSystemGeneratedOutputStore();
  await store.write(compilation, config);
  await assert.rejects(
    store.check(compilation, config),
    /repoRoot must be the Git top level/,
  );
});

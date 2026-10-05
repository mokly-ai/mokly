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

test("committed Build and Check reject ignored generated assets before writing", async (context) => {
  const { fixture, config, compilation } = await committedFixture(context);
  await fs.writeFile(
    path.join(fixture.root, ".gitignore"),
    "node_modules/\ndist/\n",
  );
  const store = new FileSystemGeneratedOutputStore();
  const message = `[mokly/build-invalid] generated files are ignored by Git:\n  - mokly-generated/assets/dist/icon.png (.gitignore:2 dist/)\n  - mokly-generated/assets/node_modules/leaflet/dist/font.woff2 (.gitignore:1 node_modules/)\nAdd to .gitignore:\n  !/mockups/mokly-generated/**`;
  await assert.rejects(store.write(compilation, config), (error: Error) => {
    assert.equal(error.message, message);
    return true;
  });
  await assert.rejects(
    async () => store.check(compilation, config),
    (error: Error) => {
      assert.equal(error.message, message);
      return true;
    },
  );
  await fs.appendFile(
    path.join(fixture.root, ".gitignore"),
    "!/mockups/mokly-generated/**\n",
  );
  await store.write(compilation, config);
  await store.check(compilation, config);
  await git(fixture.root, "add", "-A");
  const staged = await git(fixture.root, "diff", "--cached", "--name-only");
  assert.match(staged, /mockups\/mokly-generated\/assets\/dist\/icon\.png/);
  assert.match(
    staged,
    /mockups\/mokly-generated\/assets\/node_modules\/leaflet\/dist\/font\.woff2/,
  );
});

test("committed output identifies ignored mockups ancestors", async (context) => {
  const { fixture, config, compilation } = await committedFixture(context);
  await fs.writeFile(path.join(fixture.root, ".gitignore"), "mockups/\n");
  await assert.rejects(
    new FileSystemGeneratedOutputStore().write(compilation, config),
    /mockups directory is ignored by Git: \.gitignore:1 mockups\/; remove that rule or use generatedOutput: "derived"/,
  );
});

test("committed output honors nested negations and tracked files", async (context) => {
  const { fixture, config, compilation } = await committedFixture(context);
  await fs.writeFile(path.join(fixture.mockupsDir, ".gitignore"), "dist/\n");
  const store = new FileSystemGeneratedOutputStore();
  await assert.rejects(
    store.write(compilation, config),
    /Add to mockups\/\.gitignore:\n {2}!\/mokly-generated\/\*\*/,
  );
  await fs.appendFile(
    path.join(fixture.mockupsDir, ".gitignore"),
    "!/mokly-generated/**\n",
  );
  await store.write(compilation, config);
  await store.check(compilation, config);
  await git(fixture.root, "add", "-A");
  await fs.writeFile(path.join(fixture.mockupsDir, ".gitignore"), "dist/\n");
  await store.check(compilation, config);
});

test("committed output suggests exact negations for HTML and manifest routes", async (context) => {
  const { fixture, config, compilation } = await committedFixture(context);
  await fs.writeFile(
    path.join(fixture.root, ".gitignore"),
    "*.html\nmockups/mokly-manifest.json\n",
  );
  await assert.rejects(
    new FileSystemGeneratedOutputStore().write(compilation, config),
    (error: Error) => {
      assert.match(error.message, /!\/mockups\/mokly-manifest\.json/);
      assert.match(error.message, /!\/mockups\/screens\/home\.desktop\.html/);
      return true;
    },
  );
});

test("committed fixtures inside a parent Git tree retain existing behavior", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const store = new FileSystemGeneratedOutputStore();
  await store.write(compilation, config);
  await store.check(compilation, config);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("build replaces the entire generated tree without touching authored files", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  await fs.promises.writeFile(
    path.join(config.generatedDir, "unexpected.txt"),
    "old",
  );
  const authored = path.join(config.mockupsDir, "authored.txt");
  await fs.promises.writeFile(authored, "mine");

  await writeCompilation(compilation, config);
  assert.equal(
    fs.existsSync(path.join(config.generatedDir, "unexpected.txt")),
    false,
  );
  assert.equal(await fs.promises.readFile(authored, "utf8"), "mine");
});

test("failed tree installation restores all previous bytes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  await fs.promises.writeFile(
    path.join(config.generatedDir, "extra.txt"),
    "keep",
  );
  const original = await readTree(config.generatedDir);
  const rename = fs.promises.rename.bind(fs.promises);
  context.mock.method(
    fs.promises,
    "rename",
    async (source: string, target: string) => {
      if (source.endsWith(`${path.sep}stage`) && target === config.generatedDir)
        throw new Error("injected install failure");
      return rename(source, target);
    },
  );

  await assert.rejects(
    () => writeCompilation(compilation, config),
    /injected install failure/,
  );
  assert.deepEqual(await readTree(config.generatedDir), original);
  assert.deepEqual(
    (await fs.promises.readdir(config.mockupsDir)).filter((name) =>
      name.startsWith(".mokly-write-"),
    ),
    [],
  );
});

test("build refuses symlinks at and inside the generated tree without following them", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const external = path.join(config.mockupsDir, "original.txt");
  await fs.promises.writeFile(external, "original");
  await fs.promises.symlink(config.mockupsDir, config.generatedDir, "dir");
  await assert.rejects(
    () => writeCompilation(compilation, config),
    /symbolic link/i,
  );
  assert.equal(await fs.promises.readFile(external, "utf8"), "original");
  await fs.promises.unlink(config.generatedDir);
  await writeCompilation(compilation, config);
  await fs.promises.symlink(
    external,
    path.join(config.generatedDir, "extra.txt"),
  );
  await assert.rejects(
    () => writeCompilation(compilation, config),
    /symbolic link/i,
  );
  assert.equal(await fs.promises.readFile(external, "utf8"), "original");
});

test("a crashed build backup cannot be overwritten when the output tree is missing", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const leftover = path.join(
    config.mockupsDir,
    ".mokly-write-.generated-crashed",
  );
  await fs.promises.mkdir(path.join(leftover, "backup"), { recursive: true });
  await fs.promises.writeFile(
    path.join(leftover, "backup", "screen.html"),
    "previous",
  );
  await assert.rejects(
    () => writeCompilation(compilation, config),
    /previous generated tree.*backup/i,
  );
  assert.equal(
    await fs.promises.readFile(
      path.join(leftover, "backup", "screen.html"),
      "utf8",
    ),
    "previous",
  );
  assert.equal(fs.existsSync(config.generatedDir), false);
});

test("a crashed stage without a backup does not block the next build", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const leftover = path.join(
    config.mockupsDir,
    ".mokly-write-.generated-staged",
  );
  await fs.promises.mkdir(path.join(leftover, "stage"), { recursive: true });
  await fs.promises.writeFile(
    path.join(leftover, "stage", "partial.html"),
    "partial",
  );

  await writeCompilation(compilation, config);
  assert.equal(
    fs.existsSync(path.join(config.generatedDir, "mokly-manifest.json")),
    true,
  );
  assert.equal(
    await fs.promises.readFile(
      path.join(leftover, "stage", "partial.html"),
      "utf8",
    ),
    "partial",
  );
});

test("a live generated tree ignores and preserves a leftover backup", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  const leftover = path.join(config.mockupsDir, ".mokly-write-.generated-old");
  await fs.promises.mkdir(path.join(leftover, "backup"), { recursive: true });
  await fs.promises.writeFile(
    path.join(leftover, "backup", "old.html"),
    "previous",
  );
  await fs.promises.writeFile(
    path.join(config.generatedDir, "extra.html"),
    "extra",
  );

  await writeCompilation(compilation, config);
  assert.equal(
    fs.existsSync(path.join(config.generatedDir, "extra.html")),
    false,
  );
  assert.equal(
    await fs.promises.readFile(
      path.join(leftover, "backup", "old.html"),
      "utf8",
    ),
    "previous",
  );
});

async function readTree(root: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  async function visit(dir: string): Promise<void> {
    for (const entry of await fs.promises.readdir(dir, {
      withFileTypes: true,
    })) {
      const candidate = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else
        files.set(
          path.relative(root, candidate),
          await fs.promises.readFile(candidate),
        );
    }
  }
  await visit(root);
  return files;
}

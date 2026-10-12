import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  identityFilename,
  renderingDependencies,
  renderingDependencyNames,
  templateDigest,
} from "../scripts/large/identity.mjs";
import { prepareFixture, preparedFixture } from "../scripts/large/setup.mjs";

import { generateLargeFixture, largeSize } from "./fixtures/large/generate.js";
import { fileTree } from "./helpers/file_tree.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("either renderer generates from a standalone copy of only the fixture templates", async (testContext) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-template-only-"),
  );
  testContext.after(() => fs.rm(directory, { recursive: true, force: true }));
  const templates = path.join(directory, "templates");
  await fs.cp(path.join(repositoryRoot, "tests/fixtures/large"), templates, {
    recursive: true,
  });
  const generator = (await import(
    pathToFileURL(path.join(templates, "generate.ts")).href
  )) as { generateLargeFixture: typeof generateLargeFixture };
  for (const inlineStyles of [false, true]) {
    const root = path.join(directory, inlineStyles ? "cumulative" : "default");
    await fs.mkdir(root);
    await generator.generateLargeFixture(root, {
      areas: 1,
      screens: 2,
      rows: 1,
      inlineStyles,
    });
    const original = path.join(
      directory,
      inlineStyles ? "original-cumulative" : "original-default",
    );
    await fs.mkdir(original);
    await generateLargeFixture(original, {
      areas: 1,
      screens: 2,
      rows: 1,
      inlineStyles,
    });
    assert.deepEqual(await fileTree(root), await fileTree(original));
    assert.equal(
      await fs.readFile(path.join(root, "theme.ts"), "utf8"),
      await fs.readFile(path.join(templates, "theme.ts"), "utf8"),
    );
    assert.match(
      await fs.readFile(path.join(root, "renderer.tsx"), "utf8"),
      /from "\.\/theme\.js"/,
    );
  }
  const previous = await templateDigest(templates);
  await fs.appendFile(
    path.join(templates, "theme.ts"),
    "\nexport const identityProbe = true;\n",
  );
  assert.notEqual(await templateDigest(templates), previous);
});

test("rendering provenance resolves all eight installed package versions", async () => {
  const versions = await renderingDependencies(repositoryRoot);
  assert.deepEqual(Object.keys(versions), renderingDependencyNames);
  for (const version of Object.values(versions))
    assert.match(version, /^\d+\.\d+\.\d+/);
});

test("template identity frames sorted UTF-8 paths and exact bytes, excluding only root README", async (testContext) => {
  const directory = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/template-digest-"),
  );
  testContext.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, "nested"));
  const files = new Map([
    ["é", Buffer.from([0, 255, 12])],
    [".hidden", Buffer.from("hidden")],
    ["nested/README.md", Buffer.from("nested")],
    ["a", Buffer.from("first")],
  ]);
  for (const [name, bytes] of files)
    await fs.writeFile(path.join(directory, name), bytes);
  await fs.writeFile(path.join(directory, "README.md"), "excluded");
  const hash = createHash("sha256");
  for (const [name, bytes] of [...files].sort(([left], [right]) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)),
  )) {
    const nameBytes = Buffer.from(name);
    const prefix = Buffer.alloc(4);
    prefix.writeUInt32BE(nameBytes.length);
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(bytes.length));
    hash.update(prefix).update(nameBytes).update(length).update(bytes);
  }
  const digest = await templateDigest(directory);
  assert.equal(digest, hash.digest("hex"));
  await fs.writeFile(path.join(directory, "README.md"), "new measurement");
  assert.equal(await templateDigest(directory), digest);
  await fs.writeFile(path.join(directory, ".hidden"), "new bytes");
  assert.notEqual(await templateDigest(directory), digest);
  await fs.symlink("a", path.join(directory, "link"));
  await assert.rejects(templateDigest(directory), /symlink/);
});

test(
  "both indexed and --config fixture reuse require the authoritative root digest before any edits",
  { timeout: 120_000 },
  async (testContext) => {
    const size = largeSize({
      areas: 1,
      screens: 2,
      rows: 2,
      stylesheets: 1,
      stylesheetShare: 0.37,
    });
    const index = path.join(
      repositoryRoot,
      ".context/large-1-2-2-1-0.37-tracked.json",
    );
    const previous = await fs.readFile(index).catch(() => undefined);
    testContext.after(async () => {
      if (previous) await fs.writeFile(index, previous);
      else await fs.rm(index, { force: true });
    });
    const fixture = await prepareFixture(repositoryRoot, size, false, true);
    testContext.after(() =>
      fs.rm(fixture.root, { recursive: true, force: true }),
    );
    const rootRecord = path.join(fixture.root, identityFilename);
    const original = await fs.readFile(rootRecord, "utf8");
    const identity = JSON.parse(original);
    assert.deepEqual(
      identity.renderingDependencies,
      await renderingDependencies(repositoryRoot, fixture.root),
    );
    assert.equal(
      identity.templateDigest,
      await templateDigest(path.join(repositoryRoot, "tests/fixtures/large")),
    );
    for (const config of [undefined, fixture.configPath]) {
      const reused = await preparedFixture(repositoryRoot, size, true, config);
      assert.equal(reused.fixtureCommit, identity.fixtureCommit);
      assert.equal(reused.preparedMoklyCommit, identity.moklyCommit);
      assert.deepEqual(
        reused.preparedRenderingDependencies,
        identity.renderingDependencies,
      );
      await fs.writeFile(
        rootRecord,
        JSON.stringify({ ...identity, templateDigest: "0".repeat(64) }),
      );
      await assert.rejects(
        preparedFixture(repositoryRoot, size, true, config),
        /template identity.*npm run fixture:large -- --areas 1 --screens 2 --rows 2 --stylesheets 1 --stylesheet-share 0\.37/,
      );
      await fs.rm(rootRecord);
      await assert.rejects(
        preparedFixture(repositoryRoot, size, true, config),
        /Prepare this fixture first/,
      );
      for (const malformed of [{}, { ...identity, screens: 1 }]) {
        await fs.writeFile(rootRecord, JSON.stringify(malformed));
        await assert.rejects(
          preparedFixture(repositoryRoot, size, true, config),
          /npm run fixture:large -- --areas 1 --screens 2 --rows 2 --stylesheets 1 --stylesheet-share 0\.37/,
        );
      }
      await fs.writeFile(rootRecord, original);
    }
  },
);

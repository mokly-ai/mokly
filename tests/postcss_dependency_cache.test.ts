import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { collectPostcssDependencies } from "../dist/build/styles/dependency_inventory.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("ordinary dependency validation shares one physical projection", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const file = path.join(fixture.entriesDir, "tokens.css");
  await fs.promises.writeFile(file, ".token{}");
  const stat = context.mock.method(fs, "lstatSync");
  const inventory = collectPostcssDependencies(
    config,
    [
      {
        type: "dependency",
        plugin: "fixture",
        source: fixture.entryPath,
        file,
        malformed: false,
      },
      {
        type: "dir-dependency",
        plugin: "fixture",
        source: fixture.entryPath,
        directory: fixture.entriesDir,
        glob: "*.css",
        malformed: false,
      },
    ],
    new Set(),
  );
  assert.deepEqual([...inventory.sourceFiles], [file]);
  assert.equal(
    stat.mock.calls.filter((call) => call.arguments[0] === file).length,
    1,
  );
});

test("a new dependency collection rechecks changed physical targets", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const source = path.join(fixture.entriesDir, "tokens.css");
  const publicFile = path.join(fixture.mockupsDir, "public.css");
  const alias = path.join(fixture.entriesDir, "alias.css");
  await fs.promises.writeFile(source, ".source{}");
  await fs.promises.writeFile(publicFile, ".public{}");
  await fs.promises.symlink(source, alias);
  const reports = [
    {
      type: "dependency" as const,
      plugin: "fixture",
      source: fixture.entryPath,
      file: alias,
      malformed: false,
    },
  ];
  assert.deepEqual(
    [...collectPostcssDependencies(config, reports, new Set()).sourceFiles],
    [alias],
  );
  await fs.promises.unlink(alias);
  await fs.promises.symlink(publicFile, alias);
  assert.throws(
    () => collectPostcssDependencies(config, reports, new Set()),
    /scanned a public mockups file/,
  );
});

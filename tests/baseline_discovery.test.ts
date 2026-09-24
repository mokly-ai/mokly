import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { discoverHistoricalCatalogue } from "../dist/baseline/discovery.js";
import { NodeBaselineFileSystem } from "../dist/baseline/filesystem.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const historicalManifest = JSON.stringify({
  entries: [],
  generatedBy: "mokly",
  schemaVersion: 5,
  sourceFiles: [],
});

test("historical discovery prefers the requested root and otherwise requires one moved root", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const request = {
    repoRoot: fixture.root,
    commit: "a".repeat(40),
    mockupsPath: "mockups",
    commands: [],
  };
  const discover = () =>
    discoverHistoricalCatalogue(
      new NodeBaselineFileSystem(),
      fixture.root,
      request,
    );
  await assert.rejects(discover(), /candidates: \(none\)/);

  const manifest = async (directory: string) => {
    const target = path.join(fixture.root, directory);
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(
      path.join(target, "mokly-manifest.json"),
      historicalManifest,
    );
  };
  await manifest("old/generated");
  await fs.symlink("old/generated", path.join(fixture.root, "alias"));
  await manifest("node_modules/ignored");
  assert.equal((await discover()).descriptor.catalogueRoot, "old/generated");

  await manifest("other/output");
  await assert.rejects(
    discover(),
    /candidates: old\/generated \(legacy\), other\/output \(legacy\)/,
  );
  await manifest("mockups");
  assert.equal((await discover()).descriptor.catalogueRoot, "mockups");
});

test("an invalid v6 manifest is not rediscovered as a legacy child", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const directory = path.join(fixture.root, "old/.generated");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "mokly-manifest.json"),
    historicalManifest,
  );
  await assert.rejects(
    discoverHistoricalCatalogue(new NodeBaselineFileSystem(), fixture.root, {
      repoRoot: fixture.root,
      commit: "a".repeat(40),
      mockupsPath: "mockups",
      commands: [],
    }),
    /candidates: \(none\)/,
  );
});

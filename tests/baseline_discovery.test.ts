import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { discoverHistoricalCatalogue } from "../dist/baseline/discovery.js";
import { NodeBaselineFileSystem } from "../dist/baseline/filesystem.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const historicalManifest = JSON.stringify({
  entries: [],
  folders: [],
  generatedBy: "mokly",
  schemaVersion: 10,
  assetClosure: [],
  blobHashAlgorithm: "sha1",
  generatedFiles: [],
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
    const target = path.join(fixture.root, directory, "mokly-generated");
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
    /candidates: old\/generated \(generated-v10\), other\/output \(generated-v10\)/,
  );
  await manifest("mockups");
  assert.equal((await discover()).descriptor.catalogueRoot, "mockups");
});

test("an invalid v10 manifest is not rediscovered as a legacy child", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const directory = path.join(fixture.root, "old/mokly-generated");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "mokly-manifest.json"), "{}");
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

for (const stale of ["mockups", "retired", "mockups and retired"]) {
  test(`a unique moved v10 catalogue wins over stale envelopes at ${stale}`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    for (const root of stale.split(" and ")) {
      await fs.mkdir(path.join(fixture.root, root), { recursive: true });
      await fs.writeFile(
        path.join(fixture.root, root, "mokly-manifest.json"),
        JSON.stringify({ schemaVersion: 7 }),
      );
    }
    const target = path.join(fixture.root, "current/mokly-generated");
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(
      path.join(target, "mokly-manifest.json"),
      historicalManifest,
    );
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
    assert.equal((await discover()).descriptor.catalogueRoot, "current");
    await fs.mkdir(path.join(fixture.root, "second/mokly-generated"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(fixture.root, "second/mokly-generated/mokly-manifest.json"),
      historicalManifest,
    );
    await assert.rejects(
      discover(),
      /candidates: current \(generated-v10\), second \(generated-v10\)/,
    );
    await fs.rm(path.join(fixture.root, "current"), { recursive: true });
    await fs.rm(path.join(fixture.root, "second"), { recursive: true });
    await assert.rejects(
      discover(),
      stale.includes(" and ")
        ? /candidates: mockups \(incompatible-earlier\), retired \(incompatible-earlier\)/
        : { code: "baseline-incompatible-earlier" },
    );
  });
}

for (const value of ["{}", '{"schemaVersion":11}', "{broken"]) {
  test(`a requested malformed or newer manifest still rejects: ${value}`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.mockupsDir, "mokly-manifest.json"),
      value,
    );
    const current = path.join(fixture.root, "moved/mokly-generated");
    await fs.mkdir(current, { recursive: true });
    await fs.writeFile(
      path.join(current, "mokly-manifest.json"),
      historicalManifest,
    );
    await assert.rejects(
      discoverHistoricalCatalogue(new NodeBaselineFileSystem(), fixture.root, {
        repoRoot: fixture.root,
        commit: "a".repeat(40),
        mockupsPath: "mockups",
        commands: [],
      }),
      (error: Error & { code?: string }) => {
        assert.notEqual(error.code, "baseline-incompatible-earlier");
        return true;
      },
    );
  });
}

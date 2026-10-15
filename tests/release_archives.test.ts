import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createPackageArchive,
  inspectDryRun,
} from "../scripts/release/archive.mjs";
import { inspectPackedManifest } from "../scripts/release/packed_manifest.mjs";
import {
  packViewer,
  inspectViewerArchive,
} from "../scripts/release/viewer.mjs";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("viewer packing uses its lifecycle build and returns the exact archive inventory", async (t) => {
  const fixture = await bootstrapFixture(t);
  const packed = await createPackageArchive(
    path.join(fixture.root, "packages/viewer"),
    fixture.destination,
  );
  assert.equal(packed.report.name, "@mokly/viewer");
  assert.equal(packed.report.version, "0.1.0");
  assert.ok(packed.report.files.some((file) => file.path === "dist/index.js"));
  assert.ok(packed.report.files.every((file) => !file.path.startsWith("src/")));
  assert.ok((await fs.stat(packed.archivePath)).size > 0);
  const dryRun = await inspectDryRun(
    path.join(fixture.root, "packages/viewer"),
  );
  assert.deepEqual(dryRun.files, packed.report.files);
});

async function archiveFixture(t: test.TestContext) {
  const fixture = await bootstrapFixture(t);
  const metadata = JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, "packages/viewer/package.json"),
      "utf8",
    ),
  );
  metadata.version = "0.1.0";
  metadata.scripts = { prepack: "node ../../build.mjs" };
  await fs.writeFile(
    path.join(fixture.root, "packages/viewer/package.json"),
    JSON.stringify(metadata),
  );
  return fixture;
}

test("exact archive verification rejects changed bytes after packing", async (t) => {
  const fixture = await archiveFixture(t);
  const packed = await packViewer(fixture.root, fixture.destination);
  const report = path.join(fixture.destination, "viewer/pack-report.json");
  await fs.writeFile(report, JSON.stringify(packed.report));
  await inspectViewerArchive(fixture.destination);
  await fs.appendFile(packed.archivePath, "changed after checking");
  await assert.rejects(inspectViewerArchive(fixture.destination), /sha512-/);
});

test("packing rejects wrong exports and local dependencies in the actual manifest", async (t) => {
  const fixture = await archiveFixture(t);
  const file = path.join(fixture.root, "packages/viewer/package.json");
  const original = JSON.parse(await fs.readFile(file, "utf8"));
  for (const mutation of [
    { exports: { ".": "./dist/private.js" } },
    { devDependencies: { other: "file:../other" } },
  ]) {
    await fs.writeFile(file, JSON.stringify({ ...original, ...mutation }));
    const packed = await createPackageArchive(
      path.dirname(file),
      fixture.destination,
    );
    await assert.rejects(
      inspectPackedManifest(packed.archivePath, packed.report),
    );
    await assert.rejects(packViewer(fixture.root, fixture.destination));
  }
});

test("packing checks runtime licences before running the lifecycle", async (t) => {
  const fixture = await archiveFixture(t);
  const file = path.join(fixture.root, "package-lock.json");
  const lock = JSON.parse(await fs.readFile(file, "utf8"));
  delete lock.packages["packages/viewer"].license;
  await fs.writeFile(file, JSON.stringify(lock));
  await assert.rejects(
    packViewer(fixture.root, fixture.destination),
    /licenses must be declared/,
  );
  await assert.rejects(
    fs.stat(path.join(fixture.root, "packages/viewer/dist")),
    { code: "ENOENT" },
  );
});

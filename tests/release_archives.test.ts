import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createPackageArchive,
  inspectDryRun,
} from "../scripts/release/archive.mjs";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";

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

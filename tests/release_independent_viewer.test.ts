import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { requireUnpublishedRelease } from "../scripts/release/fresh.mjs";
import {
  inspectReleasePackage,
  savePackage,
  sourceIdentity,
} from "../scripts/release/package_set.mjs";
import { downloadViewer } from "../scripts/release/published_viewer.mjs";
import { packViewer } from "../scripts/release/viewer.mjs";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { viewerPackageReport } from "./helpers/release_fixture.js";

test("CLI-only freshness checks require the six new packages to be absent", async () => {
  const names: string[] = [];
  await requireUnpublishedRelease(
    repositoryRoot,
    async (_file, args) => {
      names.push(args[1]!);
      return { code: 1, signal: null, stdout: "", stderr: "E404" };
    },
    { reuseViewer: true },
  );
  assert.equal(names.length, 6);
  assert.ok(names.some((name) => name.startsWith("@mokly/mokly@")));
  assert.ok(names.every((name) => !name.startsWith("@mokly/viewer@")));
});

test("CLI-only packing downloads the exact viewer version without lifecycle scripts", async (t) => {
  const fixture = await bootstrapFixture(t);
  const report = { ...viewerPackageReport(), filename: "viewer.tgz" };
  const packed = await downloadViewer(
    fixture.root,
    fixture.destination,
    async (file, args, options) => {
      assert.equal(file, "npm");
      assert.deepEqual(args, [
        "pack",
        "@mokly/viewer@0.1.0",
        "--json",
        "--ignore-scripts",
        "--pack-destination",
        fixture.destination,
      ]);
      assert.equal(options.cwd, fixture.root);
      return { stdout: JSON.stringify([report]), stderr: "" };
    },
  );
  assert.equal(
    packed.archivePath,
    path.join(fixture.destination, "viewer.tgz"),
  );
  for (const mutation of [
    { version: "0.2.0" },
    { filename: "../viewer.tgz" },
    { name: "@mokly/mokly" },
  ])
    await assert.rejects(
      downloadViewer(fixture.root, fixture.destination, async () => ({
        stdout: JSON.stringify([{ ...report, ...mutation }]),
        stderr: "",
      })),
    );
  await assert.rejects(
    fs.stat(path.join(fixture.root, "packages/viewer/dist")),
    { code: "ENOENT" },
  );
});

test("a reused viewer archive keeps its earlier source identity and detects changed bytes", async (t) => {
  const fixture = await bootstrapFixture(t);
  const file = path.join(fixture.root, "packages/viewer/package.json");
  const metadata = JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, "packages/viewer/package.json"),
      "utf8",
    ),
  );
  metadata.version = "0.1.0";
  metadata.scripts = { prepack: "node ../../build.mjs" };
  await fs.writeFile(file, JSON.stringify(metadata));
  await fixture.git("add", "packages/viewer/package.json");
  await fixture.git("commit", "-m", "test: viewer release");
  await fixture.git("tag", "viewer-v0.1.0");
  const identity = await sourceIdentity(fixture.root);
  const packed = await packViewer(fixture.root, fixture.destination);
  await savePackage(packed, identity);
  await fs.writeFile(path.join(fixture.root, "core.txt"), "core-only release");
  await fixture.git("add", "core.txt");
  await fixture.git("commit", "-m", "fix: core only");
  const descriptor = {
    name: "@mokly/viewer",
    directory: "packages/viewer",
    artifact: "viewer",
  };
  await inspectReleasePackage(fixture.root, fixture.destination, descriptor, {
    reuseViewer: true,
  });
  await assert.rejects(
    inspectReleasePackage(fixture.root, fixture.destination, descriptor),
    /release commit/,
  );
  await fs.appendFile(packed.archivePath, "changed");
  await assert.rejects(
    inspectReleasePackage(fixture.root, fixture.destination, descriptor, {
      reuseViewer: true,
    }),
    /sha512/,
  );
});

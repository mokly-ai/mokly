import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";
import type { PackageReport } from "./helpers/release_fixture.js";

interface Archive {
  archivePath: string;
  report: PackageReport;
}

async function archiveFixture(t: test.TestContext, viewerVersion?: string) {
  const fixture = await bootstrapFixture(t);
  for (const relative of [".", "packages/viewer"]) {
    const metadata = JSON.parse(
      await fs.readFile(
        path.join(repositoryRoot, relative, "package.json"),
        "utf8",
      ),
    ) as {
      version: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    if (viewerVersion) {
      if (relative === ".")
        metadata.dependencies["@mokly/viewer"] = viewerVersion;
      else metadata.version = viewerVersion;
    }
    metadata.scripts = {
      prepack: relative === "." ? "node build.mjs" : "node ../../build.mjs",
    };
    await fs.writeFile(
      path.join(fixture.root, relative, "package.json"),
      JSON.stringify(metadata),
    );
  }
  const { createPackageArchive } = (await import(
    pathToFileURL(path.join(repositoryRoot, "scripts/package/archive.mjs")).href
  )) as {
    createPackageArchive(
      root: string,
      output: string,
      name?: string,
    ): Promise<Archive>;
  };
  const { inspectPackagePair } = (await import(
    pathToFileURL(path.join(repositoryRoot, "scripts/package/pair.mjs")).href
  )) as {
    inspectPackagePair(cli: Archive, viewer: Archive): Promise<void>;
  };
  const viewer = await createPackageArchive(
    path.join(fixture.root, "packages/viewer"),
    path.join(fixture.destination, "viewer"),
    "@mokly/viewer",
  );
  const packCli = () =>
    createPackageArchive(fixture.root, path.join(fixture.destination, "cli"));
  return { ...fixture, viewer, packCli, inspectPackagePair };
}

for (const version of [undefined, "0.1.0", "0.2.0", "1.4.7"]) {
  test(`packed manifests reject stale pairs at viewer ${version ?? "checkout version"}`, async (t) => {
    const fixture = await archiveFixture(t, version);
    await fixture.inspectPackagePair(await fixture.packCli(), fixture.viewer);
    const filename = path.join(fixture.root, "package.json");
    const metadata = JSON.parse(await fs.readFile(filename, "utf8")) as {
      dependencies: Record<string, string>;
    };
    const pairedVersion = fixture.viewer.report.version;
    const [major, minor, patch] = pairedVersion.split(".").map(Number);
    const mismatchedVersion = `${major}.${minor}.${patch! + 1}`;
    for (const version of [
      "workspace:*",
      "file:packages/viewer",
      `^${pairedVersion}`,
      mismatchedVersion,
    ]) {
      metadata.dependencies["@mokly/viewer"] = version;
      await fs.writeFile(filename, JSON.stringify(metadata));
      const cli = await fixture.packCli();
      await assert.rejects(
        fixture.inspectPackagePair(cli, fixture.viewer),
        /local dependency|exact viewer version/,
      );
    }
  });
}

test("exact archive verification rejects changed bytes after packing", async (t) => {
  const fixture = await archiveFixture(t);
  const cli = await fixture.packCli();
  await fs.appendFile(fixture.viewer.archivePath, "changed after checking");
  await assert.rejects(
    fixture.inspectPackagePair(cli, fixture.viewer),
    /sha512-/,
  );
});

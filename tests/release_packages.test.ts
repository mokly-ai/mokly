import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./helpers/fixture.js";
import { viewerPackageReport } from "./helpers/release_fixture.js";

interface Metadata {
  name: string;
  version: string;
  license: string;
  exports: Record<string, string | Record<string, string>>;
  files: string[];
  peerDependencies: Record<string, string>;
  dependencies?: Record<string, string>;
}

interface ManifestModule {
  validatePackageManifest(metadata: Metadata, name: string): void;
  validateVersionPair(cli: Metadata, viewer: Metadata): void;
}

async function manifestModule(): Promise<ManifestModule> {
  return (await import(
    pathToFileURL(path.join(repositoryRoot, "scripts/package/manifest.mjs"))
      .href
  )) as ManifestModule;
}

async function metadata(relative: string): Promise<Metadata> {
  return JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, relative, "package.json"),
      "utf8",
    ),
  ) as Metadata;
}

test("both package manifests enforce their public release boundaries", async () => {
  const { validatePackageManifest } = await manifestModule();
  for (const relative of [".", "packages/viewer"]) {
    const original = await metadata(relative);
    validatePackageManifest(original, original.name);
    const invalid: Array<(value: Metadata) => void> = [
      (value) => {
        value.name = "@other/viewer";
      },
      (value) => {
        value.version = "01.2.3";
      },
      (value) => {
        value.license = "UNLICENSED";
      },
      (value) => {
        delete value.exports["."];
      },
      (value) => {
        value.files.push("src");
      },
      (value) => {
        delete value.peerDependencies["react-dom"];
      },
      (value) => {
        value.dependencies = { other: "workspace:*" };
      },
      (value) => {
        value.dependencies = { other: "file:../other" };
      },
    ];
    for (const mutate of invalid) {
      const changed = structuredClone(original);
      mutate(changed);
      assert.throws(() => validatePackageManifest(changed, original.name));
    }
  }
});

test("exact viewer pairing accepts later releases and rejects ranges or stale versions", async () => {
  const { validateVersionPair } = await manifestModule();
  const cli = await metadata(".");
  const viewer = await metadata("packages/viewer");
  viewer.version = "0.2.0";
  cli.dependencies = { ...cli.dependencies, "@mokly/viewer": "0.2.0" };
  assert.doesNotThrow(() => validateVersionPair(cli, viewer));
  for (const version of [
    "0.1.0",
    "^0.2.0",
    "~0.2.0",
    "workspace:*",
    "file:packages/viewer",
  ]) {
    cli.dependencies["@mokly/viewer"] = version;
    assert.throws(
      () => validateVersionPair(cli, viewer),
      /exact viewer version/,
    );
  }
});

test("registry guard accepts a viewer report and rejects altered viewer bytes", async () => {
  const { comparePublishedPackage } = (await import(
    pathToFileURL(
      path.join(repositoryRoot, "scripts/release/registry_contract.mjs"),
    ).href
  )) as {
    comparePublishedPackage(
      local: ReturnType<typeof viewerPackageReport>,
      remote: ReturnType<typeof viewerPackageReport>,
      metadata: { gitHead?: string },
      commit: string,
    ): void;
  };
  const report = viewerPackageReport();
  comparePublishedPackage(report, structuredClone(report), {}, "c".repeat(40));
  assert.throws(
    () =>
      comparePublishedPackage(
        report,
        { ...report, integrity: "sha512-wrong" },
        {},
        "c".repeat(40),
      ),
    /integrity differs/,
  );
  assert.throws(() =>
    comparePublishedPackage(
      report,
      { ...report, name: "@other/viewer" },
      {},
      "c".repeat(40),
    ),
  );
});

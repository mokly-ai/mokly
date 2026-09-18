import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./helpers/fixture.js";
import { GUIDE_PATHS } from "./helpers/guides.js";
import {
  packageReport,
  viewerPackageReport,
} from "./helpers/release_fixture.js";

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

interface ArchiveModule {
  inspectRuntimeLicenses(root: string): Promise<void>;
  validatePackageReport(
    report: ReturnType<typeof packageReport>,
    name?: string,
  ): void;
}

async function manifestModule(): Promise<ManifestModule> {
  return (await import(
    pathToFileURL(path.join(repositoryRoot, "scripts/package/manifest.mjs"))
      .href
  )) as ManifestModule;
}

async function archiveModule(): Promise<ArchiveModule> {
  return (await import(
    pathToFileURL(path.join(repositoryRoot, "scripts/package/archive.mjs")).href
  )) as ArchiveModule;
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

test("the CLI archive requires every guide and rejects repository-only paths", async () => {
  const { validatePackageReport } = await archiveModule();
  const original = packageReport();
  validatePackageReport(original);
  for (const guidePath of GUIDE_PATHS) {
    const changed = structuredClone(original);
    changed.files = changed.files.filter(({ path }) => path !== guidePath);
    assert.throws(
      () => validatePackageReport(changed),
      new RegExp(`package is missing ${guidePath.replaceAll("/", "\\/")}`),
    );
  }
  for (const excluded of [
    "examples/basic/generated/index.html",
    "plans/package-documentation.md",
    "site/package.json",
    "tests/package.test.ts",
  ]) {
    const changed = structuredClone(original);
    changed.files.push({ path: excluded, size: 1 });
    assert.throws(() => validatePackageReport(changed), /non-allowlisted path/);
  }
});

test("runtime license inspection resolves production workspace links", async (t) => {
  const { inspectRuntimeLicenses } = await archiveModule();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-licenses-"));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  const writeLock = async (license?: string) => {
    await fs.writeFile(
      path.join(root, "package-lock.json"),
      JSON.stringify({
        packages: {
          "": { license: "MIT" },
          "packages/viewer": {
            dev: true,
            ...(license === undefined ? {} : { license }),
          },
          "node_modules/@mokly/viewer": {
            link: true,
            resolved: "packages/viewer",
          },
        },
      }),
    );
  };
  await writeLock("MIT");
  await inspectRuntimeLicenses(root);
  for (const invalid of ["UNLICENSED", "", undefined]) {
    await writeLock(invalid);
    await assert.rejects(
      inspectRuntimeLicenses(root),
      /runtime dependency licenses must be declared/,
    );
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

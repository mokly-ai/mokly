import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  inspectDryRun,
  validatePackageReport,
} from "../scripts/release/archive.mjs";
import { validatePackageManifest } from "../scripts/release/manifest.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const targets = [
  "linux-x64-gnu",
  "linux-arm64-gnu",
  "darwin-x64",
  "darwin-arm64",
  "win32-x64-msvc",
];

test("every native archive contains exactly its executable and package metadata", async () => {
  for (const target of targets) {
    const name = `@mokly/native-${target}`;
    const executable = target.startsWith("win32") ? "mokly.exe" : "mokly";
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(repositoryRoot, `packages/native-${target}/package.json`),
        "utf8",
      ),
    );
    validatePackageManifest(manifest, name);
    const report = {
      name,
      version: manifest.version,
      filename: `mokly-native-${target}-${manifest.version}.tgz`,
      integrity: "sha512-fixture",
      shasum: "a".repeat(40),
      files: [`bin/${executable}`, "package.json", "README.md", "LICENSE"].map(
        (path) => ({ path, size: 1 }),
      ),
    };
    validatePackageReport(report, name);
    for (const changed of [
      {
        ...report,
        files: report.files.filter((file) => !file.path.startsWith("bin/")),
      },
      { ...report, files: [...report.files, { path: "bin/other", size: 1 }] },
      {
        ...report,
        files: [...report.files, { path: "src/private.rs", size: 1 }],
      },
    ])
      assert.throws(() => validatePackageReport(changed, name));
    for (const changed of [
      { ...manifest, cpu: ["unsupported"] },
      { ...manifest, os: ["unsupported"] },
      { ...manifest, files: ["bin"] },
    ])
      assert.throws(() => validatePackageManifest(changed, name));
  }
});

test("the CLI archive requires its shim, sidecar, authoring, schema and packaged docs", async () => {
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, "packages/mokly/package.json"),
      "utf8",
    ),
  );
  validatePackageManifest(manifest, manifest.name);
  for (const mutate of [
    { dependencies: { ...manifest.dependencies, "@mokly/viewer": "^0.5.0" } },
    {
      optionalDependencies: {
        ...manifest.optionalDependencies,
        "@mokly/native-darwin-x64": "0.0.1",
      },
    },
    {
      optionalDependencies: {
        ...manifest.optionalDependencies,
        "@mokly/native-linux-x64-gnu": "file:../native-linux-x64-gnu",
      },
    },
    { bin: { mokly: "./dist/old.js" } },
  ])
    assert.throws(() =>
      validatePackageManifest({ ...manifest, ...mutate }, manifest.name),
    );
});

test("the built CLI inventory requires runtime, changelog, and receiver fixtures", async () => {
  const report = await inspectDryRun(
    path.join(repositoryRoot, "packages/mokly"),
    "@mokly/mokly",
  );
  for (const missing of [
    "CHANGELOG.md",
    "docs/protocol/fixtures/upload-plan-v1.json",
    "docs/protocol/fixtures/export-ownership-v3.json",
    "bin/mokly.mjs",
    "dist/sidecar.js",
    "dist/index.d.ts",
    "config.schema.json",
    "docs/guides/start/install.md",
  ]) {
    assert.throws(
      () =>
        validatePackageReport(
          {
            ...report,
            files: report.files.filter(({ path }) => path !== missing),
          },
          report.name,
        ),
      /missing/,
    );
  }
  for (const added of ["src/sidecar.ts", "tests/fixture.js"])
    assert.throws(
      () =>
        validatePackageReport(
          { ...report, files: [...report.files, { path: added, size: 1 }] },
          report.name,
        ),
      /non-allowlisted/,
    );
});

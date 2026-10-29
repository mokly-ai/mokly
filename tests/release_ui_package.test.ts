import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  inspectDryRun,
  validatePackageReport,
} from "../scripts/release/archive.mjs";
import {
  validateExportFiles,
  validatePackageManifest,
} from "../scripts/release/manifest.mjs";

import { repositoryRoot } from "./helpers/fixture.js";
import { uiPackageReport } from "./helpers/release_fixture.js";

const root = path.join(repositoryRoot, "packages/ui");

async function sourceManifest() {
  return JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
}

test("the UI package archive requires its stylesheet and metadata, and dist only", () => {
  const report = uiPackageReport();
  validatePackageReport(report, "@mokly/ui");
  for (const file of [
    "dist/styles.css",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "package.json",
  ])
    assert.throws(
      () =>
        validatePackageReport(
          {
            ...report,
            files: report.files.filter((item) => item.path !== file),
          },
          "@mokly/ui",
        ),
      /missing/,
      file,
    );
  for (const file of ["src/top-bar/top-bar.tsx", "tests/dom.ts"])
    assert.throws(
      () =>
        validatePackageReport(
          { ...report, files: [...report.files, { path: file, size: 1 }] },
          "@mokly/ui",
        ),
      /non-allowlisted/,
      file,
    );
  assert.throws(() => validatePackageReport(report, "@mokly/viewer"));
});

test("the UI manifest accepts one subpath per component", async () => {
  const manifest = await sourceManifest();
  validatePackageManifest(manifest, "@mokly/ui");
  validatePackageManifest(
    {
      ...manifest,
      exports: {
        ...manifest.exports,
        "./top-bar": {
          types: "./dist/top-bar/top-bar.d.ts",
          import: "./dist/top-bar/top-bar.js",
        },
      },
    },
    "@mokly/ui",
  );
});

test("the UI manifest rejects a component stylesheet subpath", async () => {
  const manifest = await sourceManifest();
  assert.throws(
    () =>
      validatePackageManifest(
        {
          ...manifest,
          exports: {
            ...manifest.exports,
            "./top-bar": {
              types: "./dist/top-bar/top-bar.d.ts",
              import: "./dist/top-bar/top-bar.js",
            },
            "./top-bar.css": "./dist/top-bar/top-bar.css",
          },
        },
        "@mokly/ui",
      ),
    /@mokly\/ui exports \.\/top-bar\.css, not a component/,
  );
});

test("the UI manifest enforces its public release boundaries", async () => {
  const original = await sourceManifest();
  const invalid: Array<(value: typeof original) => void> = [
    (value) => {
      value.name = "@mokly/viewer-ui";
    },
    (value) => {
      value.license = "UNLICENSED";
    },
    (value) => {
      value.types = "./dist/index.d.ts";
    },
    (value) => {
      delete value.exports["./styles.css"];
    },
    (value) => {
      value.exports["."] = "./dist/index.js";
    },
    (value) => {
      value.exports["./TopBar"] = {
        types: "./dist/TopBar/TopBar.d.ts",
        import: "./dist/TopBar/TopBar.js",
      };
    },
    (value) => {
      value.exports["./top-bar"] = "./dist/top-bar.js";
    },
    (value) => {
      value.exports["./top-bar.css"] = "./dist/top-bar.css";
    },
    (value) => {
      value.dependencies = { "@mokly/viewer": "0.16.1" };
    },
    (value) => {
      value.peerDependencies = { ...value.peerDependencies, other: "1.0.0" };
    },
    (value) => {
      value.devDependencies = { other: "file:../other" };
    },
    (value) => {
      value.sideEffects = false;
    },
    (value) => {
      value.files.push("src");
    },
    (value) => {
      value.repository.directory = "packages/viewer";
    },
  ];
  for (const mutate of invalid) {
    const changed = structuredClone(original);
    mutate(changed);
    assert.throws(() => validatePackageManifest(changed, "@mokly/ui"));
  }
});

test("the built UI package source and dry-run exports obey the release contract", async () => {
  const manifest = await sourceManifest();
  validatePackageManifest(manifest, "@mokly/ui");
  validateExportFiles(manifest, await inspectDryRun(root, "@mokly/ui"));
});

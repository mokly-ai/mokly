import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { publicPackageExportAudit } from "../scripts/verification/repository-ratchets.mjs";

import {
  commitFixture,
  createPublicExportFixture,
  git,
  writeNotes,
  writeSource,
} from "./helpers/public_export_ratchet.js";

test("a relocated package compares its published exports at the tagged source location", async (t) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": "export const kept = 1; export const removed = 2;\n",
    },
  });
  t.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  const manifest = await fs.readFile(
    path.join(fixture.root, "package.json"),
    "utf8",
  );
  await writeSource(fixture.root, "packages/cli/package.json", manifest);
  await writeSource(
    fixture.root,
    "packages/cli/src/index.ts",
    "export const kept = 1;\n",
  );
  await writeSource(
    fixture.root,
    "release-please-config.json",
    JSON.stringify({
      packages: {
        "packages/cli": {
          "release-type": "node",
          "include-component-in-tag": false,
          "include-v-in-tag": true,
        },
      },
    }),
  );
  await writeSource(
    fixture.root,
    ".release-please-manifest.json",
    JSON.stringify({ "packages/cli": "1.0.0" }),
  );
  commitFixture(fixture.root, "test: move public package");
  const missing = publicPackageExportAudit(fixture.root);
  assert.match(
    missing.findings.join("\n"),
    /removed export removed since v1\.0\.0/,
  );
  assert.doesNotMatch(missing.findings.join("\n"), /could not run|git show/);
  await writeNotes(fixture.root, "Removed `removed`.\n");
  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);
});

test("one root release keeps the viewer export history after removing its component", async (t) => {
  const fixture = await createPublicExportFixture({ tag: null });
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  for (const name of ["mokly", "viewer"]) {
    await writeSource(
      fixture.root,
      `packages/${name}/package.json`,
      JSON.stringify({
        name: `@mokly/${name}`,
        exports: { ".": "./dist/index.js" },
      }),
    );
    await writeSource(
      fixture.root,
      `packages/${name}/src/index.ts`,
      "export const kept = 1; export const removed = 2;\n",
    );
  }
  await writeSource(
    fixture.root,
    "package.json",
    JSON.stringify({
      name: "private-workspace",
      private: true,
      workspaces: ["packages/mokly", "packages/viewer"],
    }),
  );
  await writeSource(
    fixture.root,
    "release-please-config.json",
    JSON.stringify({
      packages: {
        ".": { "package-name": "@mokly/mokly", "include-v-in-tag": true },
      },
    }),
  );
  commitFixture(fixture.root, "test: release both public packages");
  git(fixture.root, "tag", "v1.0.0");
  git(fixture.root, "tag", "viewer-v0.6.0");
  await writeSource(
    fixture.root,
    "packages/viewer/src/index.ts",
    "export const kept = 1;\n",
  );
  const missing = publicPackageExportAudit(fixture.root);
  assert.match(
    missing.findings.join("\n"),
    /@mokly\/viewer removed export removed since viewer-v0\.6\.0/,
  );
  await writeNotes(fixture.root, "Removed `removed`.\n");
  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);
  commitFixture(fixture.root, "test: release shared version");
  git(fixture.root, "tag", "viewer-v1.1.0");
  await writeNotes(fixture.root, "# Release notes\n");
  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);
  assert.match(
    publicPackageExportAudit(fixture.root).summary,
    /viewer-v1\.1\.0/,
  );
});

test("a root release component audits its named public workspace package", async (t) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": "export const kept = 1; export const removed = 2;\n",
    },
  });
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const manifest = await fs.readFile(
    path.join(fixture.root, "package.json"),
    "utf8",
  );
  await writeSource(fixture.root, "packages/cli/package.json", manifest);
  await writeSource(
    fixture.root,
    "packages/cli/src/index.ts",
    "export const kept = 1;\n",
  );
  await writeSource(
    fixture.root,
    "package.json",
    JSON.stringify({
      name: "private-workspace",
      private: true,
      workspaces: ["packages/cli"],
    }),
  );
  await writeSource(
    fixture.root,
    "release-please-config.json",
    JSON.stringify({
      packages: {
        ".": {
          "release-type": "node",
          "package-name": "@fixture/package",
          "include-component-in-tag": false,
          "include-v-in-tag": true,
        },
      },
    }),
  );
  commitFixture(
    fixture.root,
    "test: separate component and public package roots",
  );
  const missing = publicPackageExportAudit(fixture.root);
  assert.match(
    missing.findings.join("\n"),
    /removed export removed since v1\.0\.0/,
  );
  await writeNotes(fixture.root, "Removed `removed`.\n");
  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);
});

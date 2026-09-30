import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { publicPackageExportAudit } from "../scripts/verification/repository-ratchets.mjs";

import {
  commitFixture,
  createPublicExportFixture,
  git,
  writeNotes,
  writePackageExports,
  writeReleaseVersion,
  writeSource,
} from "./helpers/public_export_ratchet.js";

const runtimeTarget = (target: string) => ({
  import: target,
  types: target.replace(/\.js$/u, ".d.ts"),
});

test("removed public names require an exact release-note code span", async (context) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": "export const kept = 1;\nexport const removed = 2;\n",
    },
  });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writeSource(fixture.root, "src/index.ts", "export const kept = 1;\n");
  await writeNotes(fixture.root, "Replace `removed()` with `kept`.\n");

  const unnoted = publicPackageExportAudit(fixture.root);
  assert.match(
    unnoted.findings.join("\n"),
    /@fixture\/package.*removed.*v1\.0\.0.*npm-release-notes\.md/u,
  );

  await writeNotes(fixture.root, "Replace `removed` with `kept`.\n");
  const noted = publicPackageExportAudit(fixture.root);
  assert.deepEqual(noted.findings, []);
  assert.match(noted.summary, /v1\.0\.0.*1 noted removal/u);
});

test("removed non-JavaScript subpaths require their full specifier", async (context) => {
  const fixture = await createPublicExportFixture({
    exports: {
      ".": runtimeTarget("./dist/index.js"),
      "./styles.css": "./dist/styles.css",
    },
  });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writePackageExports(fixture.root, {
    ".": runtimeTarget("./dist/index.js"),
  });

  const unnoted = publicPackageExportAudit(fixture.root);
  assert.match(
    unnoted.findings.join("\n"),
    /@fixture\/package\/styles\.css.*v1\.0\.0/u,
  );
  await writeNotes(fixture.root, "Removed `@fixture/package/styles.css`.\n");
  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);
});

test("moving a public name to another subpath still requires a note", async (context) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": "export const kept = 1;\nexport const moved = 2;\n",
    },
  });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writeSource(fixture.root, "src/index.ts", "export const kept = 1;\n");
  await writeSource(fixture.root, "src/other.ts", "export const moved = 2;\n");
  await writePackageExports(fixture.root, {
    ".": runtimeTarget("./dist/index.js"),
    "./other": runtimeTarget("./dist/other.js"),
  });

  assert.match(
    publicPackageExportAudit(fixture.root).findings.join("\n"),
    /@fixture\/package.*moved.*v1\.0\.0/u,
  );
});

test("public entry points contribute every explicit exported name", async (context) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": [
        "const local = 1;",
        "export { local as listed };",
        'export { remote as forwarded } from "./dependency.js";',
        'export type { RemoteType as ForwardedType } from "./dependency.js";',
        "export const variable = 1;",
        "export function callable() {}",
        "export class Constructed {}",
        "export interface Shape {}",
        "export type Alias = string;",
        "export enum Choice { One }",
        "export namespace Group {}",
        'export * as namespaceExport from "./dependency.js";',
        'export type * as typeNamespaceExport from "./dependency.js";',
        "export default function () {}",
      ].join("\n"),
      "src/dependency.ts":
        "export const remote = 1;\nexport type RemoteType = string;\n",
    },
  });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writeSource(fixture.root, "src/index.ts", "export const kept = 1;\n");

  const output = publicPackageExportAudit(fixture.root).findings.join("\n");
  for (const name of [
    "Alias",
    "Choice",
    "Constructed",
    "ForwardedType",
    "Group",
    "Shape",
    "callable",
    "default",
    "forwarded",
    "listed",
    "namespaceExport",
    "typeNamespaceExport",
    "variable",
  ])
    assert.match(output, new RegExp(`removed export ${name}(?: |$)`, "u"));
});

test("names added and removed after the latest tag need no note", async (context) => {
  const fixture = await createPublicExportFixture();
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writeSource(
    fixture.root,
    "src/index.ts",
    "export const kept = 1;\nexport const transient = 2;\n",
  );
  commitFixture(fixture.root, "test: add transient export");
  await writeSource(fixture.root, "src/index.ts", "export const kept = 1;\n");

  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);
});

test("a released package without a reachable tag fails closed", async (context) => {
  const fixture = await createPublicExportFixture({ tag: null });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  git(fixture.root, "switch", "--quiet", "-c", "release");
  await writeSource(
    fixture.root,
    "src/index.ts",
    "export const releasedElsewhere = 1;\n",
  );
  commitFixture(fixture.root, "test: unreachable release");
  git(fixture.root, "tag", "v1.0.0");
  git(fixture.root, "switch", "--quiet", "feature");

  assert.match(
    publicPackageExportAudit(fixture.root).findings.join("\n"),
    /@fixture\/package.*git fetch --tags origin/u,
  );
});

test("an unreleased 0.0.0 package is skipped without a tag", async (context) => {
  const fixture = await createPublicExportFixture({
    tag: null,
    version: "0.0.0",
  });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));

  const result = publicPackageExportAudit(fixture.root);
  assert.deepEqual(result.findings, []);
  assert.match(result.summary, /0 released package/u);
});

test("release status comes from HEAD rather than the working tree", async (context) => {
  const fixture = await createPublicExportFixture({ tag: null });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writeReleaseVersion(fixture.root, "0.0.0");

  assert.match(
    publicPackageExportAudit(fixture.root).findings.join("\n"),
    /@fixture\/package.*git fetch --tags origin/u,
  );
});

test("a removal note stays required until a newer release includes it", async (context) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": "export const kept = 1;\nexport const removed = 2;\n",
    },
  });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writeSource(fixture.root, "src/index.ts", "export const kept = 1;\n");
  await writeNotes(fixture.root, "Removed `removed`.\n");
  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);

  await writeNotes(fixture.root, "# Release notes\n");
  assert.match(
    publicPackageExportAudit(fixture.root).findings.join("\n"),
    /removed.*v1\.0\.0/u,
  );

  await writeReleaseVersion(fixture.root, "1.1.0");
  commitFixture(fixture.root, "test: release removal");
  git(fixture.root, "tag", "v1.1.0");
  const released = publicPackageExportAudit(fixture.root);
  assert.deepEqual(released.findings, []);
  assert.match(released.summary, /v1\.1\.0.*0 noted removal/u);
});

test("the repository public surface has complete release notes", () => {
  const result = publicPackageExportAudit(process.cwd());
  assert.deepEqual(result.findings, []);
  assert.match(result.summary, /@mokly\/mokly: v[0-9]/u);
  assert.match(result.summary, /@mokly\/viewer: viewer-v[0-9]/u);
});

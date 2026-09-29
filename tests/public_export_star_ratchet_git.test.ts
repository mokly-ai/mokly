import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { publicPackageExportAudit } from "../scripts/verification/repository-ratchets.mjs";

import {
  createPublicExportFixture,
  writeNotes,
  writeSource,
} from "./helpers/public_export_ratchet.js";

test("released type-star names require notes when removed", async (context) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": 'export type * from "./types.js";\n',
      "src/types.ts":
        "export type Kept = string;\nexport interface RemovedType {}\n",
    },
  });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writeSource(
    fixture.root,
    "src/types.ts",
    "export type Kept = string;\n",
  );

  assert.match(
    publicPackageExportAudit(fixture.root).findings.join("\n"),
    /removed export RemovedType.*v1\.0\.0/u,
  );
  await writeNotes(fixture.root, "Replace `RemovedType` with `Kept`.\n");
  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);
});

test("nested star chains contribute their deepest names", async (context) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": 'export * from "./a.js";\n',
      "src/a.ts": 'export type * from "./b.js";\n',
      "src/b.ts": "export interface DeepType {}\n",
    },
  });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writeSource(
    fixture.root,
    "src/b.ts",
    "export interface CurrentType {}\n",
  );

  assert.match(
    publicPackageExportAudit(fixture.root).findings.join("\n"),
    /removed export DeepType.*v1\.0\.0/u,
  );
});

test("star re-exports do not contribute default", async (context) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": 'export * from "./values.js";\n',
      "src/values.ts":
        "export const kept = 1;\nexport default function removedDefault() {}\n",
    },
  });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writeSource(fixture.root, "src/values.ts", "export const kept = 1;\n");

  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);
});

test("unresolvable star targets fail closed on each side", async (context) => {
  await context.test("current relative target", async (subcontext) => {
    const fixture = await createPublicExportFixture({
      sources: {
        "src/index.ts": 'export * from "./values.js";\n',
        "src/values.ts": "export const value = 1;\n",
      },
    });
    subcontext.after(() =>
      fs.rm(fixture.root, { force: true, recursive: true }),
    );
    await writeSource(
      fixture.root,
      "src/index.ts",
      'export * from "./missing.js";\n',
    );
    assert.match(
      publicPackageExportAudit(fixture.root).findings.join("\n"),
      /current.*src\/index\.ts.*\.\/missing\.js.*cannot resolve/u,
    );
  });

  await context.test("released relative target", async (subcontext) => {
    const fixture = await createPublicExportFixture({
      sources: { "src/index.ts": 'export * from "./missing.js";\n' },
    });
    subcontext.after(() =>
      fs.rm(fixture.root, { force: true, recursive: true }),
    );
    await writeSource(
      fixture.root,
      "src/missing.ts",
      "export const value = 1;\n",
    );
    assert.match(
      publicPackageExportAudit(fixture.root).findings.join("\n"),
      /v1\.0\.0.*src\/index\.ts.*\.\/missing\.js.*cannot resolve/u,
    );
  });

  await context.test("package target", async (subcontext) => {
    const fixture = await createPublicExportFixture();
    subcontext.after(() =>
      fs.rm(fixture.root, { force: true, recursive: true }),
    );
    await writeSource(
      fixture.root,
      "src/index.ts",
      'export * from "@fixture/missing";\n',
    );
    assert.match(
      publicPackageExportAudit(fixture.root).findings.join("\n"),
      /current.*src\/index\.ts.*@fixture\/missing.*cannot resolve/u,
    );
  });
});

test("star cycles terminate and retain every reachable name", async (context) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": 'export * from "./a.js";\n',
      "src/a.ts":
        'export type CycleName = string;\nexport * from "./index.js";\n',
    },
  });
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  await writeSource(fixture.root, "src/a.ts", 'export * from "./index.js";\n');

  assert.match(
    publicPackageExportAudit(fixture.root).findings.join("\n"),
    /removed export CycleName.*v1\.0\.0/u,
  );
  await writeNotes(fixture.root, "Removed `CycleName`.\n");
  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);
});

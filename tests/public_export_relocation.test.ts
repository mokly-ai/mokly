import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { publicPackageExportAudit } from "../scripts/verification/repository-ratchets.mjs";

import {
  commitFixture,
  createPublicExportFixture,
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

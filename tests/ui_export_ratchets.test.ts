import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  internalExportAudit,
  publicPackageExportAudit,
} from "../scripts/verification/repository-ratchets.mjs";

import { startDuration } from "./helpers/durations.js";
import {
  commitFixture,
  createReleaseLayoutFixture,
  git,
  writeNotes,
  writeReleaseVersion,
  writeSource,
} from "./helpers/public_export_ratchet.js";

test("UI internal baseline entries keep the shrink-only comparison rule", () => {
  const baseline = ["packages/ui/src/internal.ts#helper"];
  const audit = (baselineAtComparison: string[]) =>
    internalExportAudit({
      modules: [
        {
          path: "packages/ui/src/internal.ts",
          source: "export const helper = 1;",
        },
      ],
      publicEntrypoints: [],
      baseline,
      baselineAtComparison,
    });
  assert.deepEqual(audit(baseline).findings, []);
  assert.deepEqual(audit([]).findings, [
    "baseline entry was not present at the comparison commit: packages/ui/src/internal.ts#helper",
  ]);
});

test("UI removals use the first UI release and advance to the newest root tag", async (context) => {
  const duration = startDuration();
  const fixture = await createReleaseLayoutFixture();
  context.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  context.after(() => context.diagnostic(`UI public audit: ${duration()}`));
  await writeUiRelease(
    fixture.root,
    "0.17.0",
    "export const kept = 1;\nexport const removed = 2;\n",
  );
  commitFixture(fixture.root, "test: release UI package");
  git(fixture.root, "tag", "v0.17.0");
  await writeWorkspace(fixture.root, "0.17.0", false);
  await writeSource(
    fixture.root,
    "packages/ui/src/control.ts",
    "export const kept = 1;\n",
  );

  const unnoted = publicPackageExportAudit(fixture.root);
  assert.deepEqual(unnoted.findings, [
    "@mokly/ui/control removed export removed since v0.17.0; name the removed export as an exact inline code span in docs/guides/start/upgrade.md",
  ]);
  assert.match(unnoted.summary, /@mokly\/ui: v0\.17\.0/u);
  await writeNotes(fixture.root, "Removed `removed`.\n");
  const noted = publicPackageExportAudit(fixture.root);
  assert.deepEqual(noted.findings, []);
  assert.match(noted.summary, /1 noted removal\(s\)/u);

  await writeUiRelease(fixture.root, "0.18.0", "export const kept = 1;\n");
  commitFixture(fixture.root, "test: release UI removal");
  git(fixture.root, "tag", "v0.18.0");
  await writeWorkspace(fixture.root, "0.18.0", false);
  await writeNotes(fixture.root, "# Release notes\n");
  const released = publicPackageExportAudit(fixture.root);
  assert.deepEqual(released.findings, []);
  assert.match(released.summary, /@mokly\/ui: v0\.18\.0/u);
  assert.match(released.summary, /0 noted removal\(s\)/u);

  await fs.rm(path.join(fixture.root, "packages/ui/package.json"));
  assert.throws(() => publicPackageExportAudit(fixture.root), {
    code: "ENOENT",
  });
});

async function writeUiRelease(root: string, version: string, source: string) {
  await Promise.all([
    writeReleaseVersion(root, version),
    writeWorkspace(root, version),
    writeSource(
      root,
      "packages/ui/package.json",
      JSON.stringify({
        name: "@mokly/ui",
        type: "module",
        version,
        exports: {
          "./control": {
            import: "./dist/control.js",
            types: "./dist/control.d.ts",
          },
          "./styles.css": "./dist/styles.css",
        },
      }),
    ),
    writeSource(root, "packages/ui/src/control.ts", source),
  ]);
}

async function writeWorkspace(root: string, version: string, ui = true) {
  await writeSource(
    root,
    "package.json",
    JSON.stringify({
      name: "fixture-workspace",
      private: true,
      version,
      workspaces: [
        "packages/mokly",
        "packages/viewer",
        ...(ui ? ["packages/ui"] : []),
      ],
    }),
  );
}

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { CLI_PACKAGE_PATH } from "../scripts/package/layout.mjs";
import { GitWorkspace } from "../scripts/verification/ratchets/git.mjs";
import {
  auditInternalExports,
  internalExportAudit,
} from "../scripts/verification/ratchets/internal-exports.mjs";
import { auditTypeScriptLength } from "../scripts/verification/ratchets/typescript-length.mjs";

import {
  createPublicExportFixture,
  git,
} from "./helpers/public_export_ratchet.js";

const candidate = "packages/viewer/src/renamed.ts";
const predecessor = "src/original.ts";
const baselinePath = "xtask/unused-internal-exports.txt";
const sourceRoot = path.posix.join(CLI_PACKAGE_PATH, "src");

function movedException(name: string, paired = true) {
  return internalExportAudit({
    modules: [{ path: candidate, source: `export const ${name} = 1;` }],
    publicEntrypoints: [],
    baseline: [`${candidate}#${name}`],
    baselineAtComparison: [`${predecessor}#known`],
    predecessors: paired ? { [candidate]: predecessor } : {},
  });
}

test("a renamed internal-export exception keeps its comparison entry", () => {
  assert.deepEqual(movedException("known").findings, []);
});

test("rename pairing cannot admit a new export name or an unpaired module", () => {
  for (const result of [
    movedException("newName"),
    movedException("known", false),
  ])
    assert.match(
      result.findings.join("\n"),
      /baseline entry was not present at the comparison commit/u,
    );
});

test("internal-export baseline accepts viewer scripts and rejects invalid prefixes", () => {
  for (const modulePath of [
    "packages/viewer/scripts/worker.mjs",
    "examples/worker.mjs",
    "packages/viewer/src-other/worker.mjs",
  ]) {
    const result = internalExportAudit({
      modules: [{ path: modulePath, source: "export const known = 1;" }],
      publicEntrypoints: [],
      baseline: [`${modulePath}#known`],
    });
    if (modulePath === "packages/viewer/scripts/worker.mjs")
      assert.deepEqual(result.findings, []);
    else assert.match(result.findings.join("\n"), /invalid.*baseline entry/u);
  }
});

test("a module moved into a source root keeps an outside-root predecessor", async (t) => {
  const fixture = await createPublicExportFixture({
    packagePath: CLI_PACKAGE_PATH,
    sources: {
      [`${sourceRoot}/index.ts`]: "export const kept = 1;\n",
      "outside/legacy.ts": "void 0;\n".repeat(310),
    },
  });
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  git(fixture.root, "update-ref", "refs/remotes/origin/main", "HEAD");
  await fs.rename(
    path.join(fixture.root, "outside/legacy.ts"),
    path.join(fixture.root, sourceRoot, "legacy.ts"),
  );
  git(fixture.root, "add", "--all");
  const workspace = new GitWorkspace(fixture.root);
  assert.deepEqual(workspace.changedFiles([sourceRoot]), [
    {
      status: "R100",
      source: "outside/legacy.ts",
      path: `${sourceRoot}/legacy.ts`,
    },
  ]);
  assert.deepEqual(auditTypeScriptLength(fixture.root, workspace).findings, []);
  await fs.appendFile(
    path.join(fixture.root, sourceRoot, "legacy.ts"),
    "void 1;\n",
  );
  assert.match(
    auditTypeScriptLength(fixture.root, workspace).findings.join("\n"),
    /311.*310.*predecessor outside\/legacy.ts/u,
  );
});

test("the workspace internal-export audit uses Git rename pairs and public manifests", async (t) => {
  const fixture = await createPublicExportFixture({
    packagePath: CLI_PACKAGE_PATH,
    sources: {
      [`${sourceRoot}/index.ts`]: "export const kept = 1;\n",
      [predecessor]: "export const known = 1;\n",
      [baselinePath]: `${predecessor}#known\n`,
      "packages/viewer/package.json": JSON.stringify({
        name: "@fixture/viewer",
        exports: { ".": "./dist/index.js" },
      }),
      "packages/viewer/src/index.ts": "export const viewerPublic = 1;\n",
    },
  });
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  git(fixture.root, "update-ref", "refs/remotes/origin/main", "HEAD");
  await fs.rename(
    path.join(fixture.root, predecessor),
    path.join(fixture.root, candidate),
  );
  await fs.writeFile(
    path.join(fixture.root, baselinePath),
    `${candidate}#known\n`,
  );
  git(fixture.root, "add", "--all");
  assert.deepEqual(
    auditInternalExports(fixture.root, new GitWorkspace(fixture.root)).findings,
    [],
  );
});

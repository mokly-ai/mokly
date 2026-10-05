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

test("public exports follow the package name across a root-to-workspace move", async (t) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": "export const kept = 1;\nexport const removed = 2;\n",
    },
  });
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  await relocate(fixture.root, ".", "packages/mokly");
  await writeSource(
    fixture.root,
    "packages/mokly/src/index.ts",
    "export const kept = 1;\n",
  );
  const result = publicPackageExportAudit(fixture.root);
  assert.match(
    result.findings.join("\n"),
    /removed export removed since v1\.0\.0/u,
  );
  await writeNotes(fixture.root, "Removed `removed`.\n");
  assert.deepEqual(publicPackageExportAudit(fixture.root).findings, []);
});

test("an uncommitted package move retains the released export baseline", async (t) => {
  const fixture = await createPublicExportFixture({
    sources: {
      "src/index.ts": "export const kept = 1;\nexport const removed = 2;\n",
    },
  });
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  await relocate(fixture.root, ".", "packages/mokly", false);
  await writeSource(
    fixture.root,
    "packages/mokly/src/index.ts",
    "export const kept = 1;\n",
  );
  assert.match(
    publicPackageExportAudit(fixture.root).findings.join("\n"),
    /removed export removed since v1\.0\.0/u,
  );
});

test("public exports resolve a different historical workspace root by name", async (t) => {
  const fixture = await createPublicExportFixture();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  await relocate(fixture.root, ".", "packages/released");
  git(fixture.root, "tag", "v1.1.0");
  await relocate(fixture.root, "packages/released", "packages/current");
  const result = publicPackageExportAudit(fixture.root);
  assert.deepEqual(result.findings, []);
  assert.match(result.summary, /@fixture\/package: v1\.1\.0/u);
});

test("public export audit fails closed when no historical package name matches", async (t) => {
  const fixture = await createPublicExportFixture();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const file = path.join(fixture.root, "package.json");
  const manifest = JSON.parse(await fs.readFile(file, "utf8"));
  manifest.name = "@fixture/renamed";
  await fs.writeFile(file, JSON.stringify(manifest));
  const result = publicPackageExportAudit(fixture.root);
  assert.match(
    result.findings.join("\n"),
    /@fixture\/renamed.*no package.*name.*v1\.0\.0/u,
  );
});

test("public export audit rejects ambiguous historical package names", async (t) => {
  const fixture = await createPublicExportFixture();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  await writeSource(
    fixture.root,
    "packages/duplicate/package.json",
    await fs.readFile(path.join(fixture.root, "package.json"), "utf8"),
  );
  await configure(fixture.root, [".", "packages/duplicate"]);
  commitFixture(fixture.root, "test: duplicate package name");
  git(fixture.root, "tag", "v1.1.0");
  await configure(fixture.root, ["."]);
  assert.match(
    publicPackageExportAudit(fixture.root).findings.join("\n"),
    /@fixture\/package.*multiple packages.*name.*v1\.1\.0/u,
  );
});

async function configure(root: string, roots: string[]) {
  await writeSource(
    root,
    "release-please-config.json",
    JSON.stringify({
      packages: Object.fromEntries(
        roots.map((name) => [
          name,
          {
            "include-component-in-tag": false,
            "include-v-in-tag": true,
          },
        ]),
      ),
    }),
  );
}

async function relocate(root: string, from: string, to: string, commit = true) {
  const destination = path.join(root, to);
  await fs.mkdir(destination, { recursive: true });
  for (const name of ["src", "package.json"])
    await fs.rename(path.join(root, from, name), path.join(destination, name));
  if (from === ".")
    await writeSource(
      root,
      "package.json",
      '{"name":"fixture-workspace","private":true}\n',
    );
  await configure(root, [to]);
  await writeSource(
    root,
    ".release-please-manifest.json",
    JSON.stringify({ [to]: "1.0.0" }),
  );
  if (commit) commitFixture(root, "test: relocate package");
}

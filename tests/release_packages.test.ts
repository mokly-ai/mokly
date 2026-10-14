import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { viewerPackageReport } from "./helpers/release_fixture.js";

const archive = (await import(
  pathToFileURL(
    path.resolve(import.meta.dirname, "../scripts/release/archive.mjs"),
  ).href
)) as {
  validatePackageReport(
    report: ReturnType<typeof viewerPackageReport>,
    name?: string,
  ): void;
  inspectRuntimeLicenses(root: string): Promise<void>;
};

test("the viewer archive requires its runtime, styles, declarations, and licence", () => {
  const report = viewerPackageReport();
  archive.validatePackageReport(report);
  for (const file of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/browser.js",
    "dist/data.js",
    "dist/styles.css",
    "LICENSE",
  ])
    assert.throws(
      () =>
        archive.validatePackageReport({
          ...report,
          files: report.files.filter((item) => item.path !== file),
        }),
      /missing/,
    );
  assert.throws(
    () =>
      archive.validatePackageReport({
        ...report,
        files: [...report.files, { path: "src/private.ts", size: 1 }],
      }),
    /non-allowlisted/,
  );
  assert.throws(() =>
    archive.validatePackageReport({ ...report, name: "@mokly/mokly" }),
  );
});

test("runtime licence inspection resolves workspace links and rejects missing licences", async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-release-licence-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const lock = {
    packages: {
      "": { private: true },
      "packages/viewer": { license: "MIT" },
      "node_modules/@mokly/viewer": { link: true, resolved: "packages/viewer" },
    },
  };
  const file = path.join(root, "package-lock.json");
  await fs.writeFile(file, JSON.stringify(lock));
  await archive.inspectRuntimeLicenses(root);
  lock.packages["packages/viewer"].license = "";
  await fs.writeFile(file, JSON.stringify(lock));
  await assert.rejects(
    archive.inspectRuntimeLicenses(root),
    /licenses must be declared/,
  );
});

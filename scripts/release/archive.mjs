import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand } from "./command.mjs";
import {
  validateCliReport,
  validateNativeReport,
  validateUiReport,
} from "./package_reports.mjs";

const ROOT_FILES = new Set([
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "package.json",
]);
export async function createPackageArchive(
  repositoryRoot,
  destination,
  name = "@mokly/viewer",
) {
  await fs.promises.mkdir(destination, { recursive: true });
  const { stdout } = await runCommand(
    "npm",
    ["pack", "--json", "--pack-destination", destination],
    { cwd: repositoryRoot },
  );
  const reports = JSON.parse(stdout);
  assert.equal(reports.length, 1, "npm pack must create exactly one archive");
  const report = reports[0];
  validatePackageReport(report, name);
  return {
    archivePath: path.join(destination, report.filename),
    report,
  };
}

export async function inspectDryRun(repositoryRoot, name = "@mokly/viewer") {
  const { stdout } = await runCommand(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: repositoryRoot },
  );
  const reports = JSON.parse(stdout);
  assert.equal(reports.length, 1, "npm pack dry-run must return one report");
  validatePackageReport(reports[0], name);
  return reports[0];
}

export function validatePackageReport(report, name = "@mokly/viewer") {
  assert.equal(report.name, name);
  assert.match(report.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.match(report.integrity, /^sha512-/);
  assert.match(report.shasum, /^[a-f0-9]{40}$/);
  if (name === "@mokly/viewer") validateViewerReport(report);
  else if (name === "@mokly/ui") validateUiReport(report);
  else if (name === "@mokly/mokly") validateCliReport(report);
  else validateNativeReport(report, name);
}

export async function inspectRuntimeLicenses(repositoryRoot) {
  const lock = JSON.parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, "package-lock.json"),
      "utf8",
    ),
  );
  const invalid = Object.entries(lock.packages)
    .filter(([key, value]) => key && value.dev !== true)
    .filter(([, value]) => {
      const license =
        value.link === true
          ? lock.packages[value.resolved]?.license
          : value.license;
      return (
        typeof license !== "string" ||
        license.trim().length === 0 ||
        license === "UNLICENSED"
      );
    })
    .map(([key]) => key);
  assert.deepEqual(invalid, [], "runtime dependency licenses must be declared");
}

function validateViewerReport(report) {
  assert.equal(report.name, "@mokly/viewer");
  assert.match(report.version, /^\d+\.\d+\.\d+$/);
  const files = report.files.map((file) => file.path);
  for (const required of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/browser.js",
    "dist/browser.d.ts",
    "dist/browser.manifest.json",
    "dist/data.js",
    "dist/data.d.ts",
    "dist/styles.css",
    "dist/shell.css",
    "dist/browser/inspector.js",
    "dist/browser/shell.js",
    "dist/assets/fonts/Inter-OFL.txt",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "package.json",
  ])
    assert.ok(
      files.includes(required),
      `viewer package is missing ${required}`,
    );
  for (const file of files)
    assert.ok(
      file.startsWith("dist/") || ROOT_FILES.has(file),
      `viewer contains non-allowlisted path ${file}`,
    );
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand } from "./command.mjs";

const ROOT_FILES = new Set([
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "package.json",
]);
const GUIDE_FILES = [
  "docs/guides/start/install.md",
  "docs/guides/start/configure.md",
  "docs/guides/start/your-first-screen.md",
  "docs/guides/start/build.md",
  "docs/guides/start/serve.md",
  "docs/guides/authoring/config.md",
  "docs/guides/authoring/styles.md",
  "docs/guides/authoring/screens.md",
  "docs/guides/authoring/components.md",
  "docs/guides/authoring/viewports-and-color-schemes.md",
  "docs/guides/authoring/collections-and-tags.md",
  "docs/guides/authoring/use-case-flows.md",
  "docs/guides/authoring/pages.md",
  "docs/guides/authoring/links.md",
  "docs/guides/authoring/review-ignore.md",
  "docs/guides/catalogue/browse.md",
  "docs/guides/catalogue/search-and-filters.md",
  "docs/guides/catalogue/changes.md",
  "docs/guides/catalogue/details.md",
  "docs/guides/catalogue/export-and-host.md",
  "docs/guides/ci/github-action.md",
  "docs/guides/ci/publish-from-ci.md",
  "docs/guides/ci/project-tokens.md",
  "docs/guides/ci/the-upload.md",
  "docs/guides/ci/the-check-on-a-pull-request.md",
  "docs/guides/cli/serve.md",
  "docs/guides/cli/build.md",
  "docs/guides/cli/check.md",
  "docs/guides/cli/export.md",
  "docs/guides/cli/publish.md",
  "docs/guides/cli/options-and-exit-status.md",
];

export async function createPackageArchive(
  repositoryRoot,
  destination,
  name = "@mokly/mokly",
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

export async function inspectDryRun(repositoryRoot, name = "@mokly/mokly") {
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

export function validatePackageReport(report, name = "@mokly/mokly") {
  assert.ok(["@mokly/mokly", "@mokly/viewer"].includes(name));
  assert.equal(report.name, name);
  assert.match(report.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.match(report.integrity, /^sha512-/);
  assert.match(report.shasum, /^[a-f0-9]{40}$/);
  if (name === "@mokly/viewer") {
    validateViewerReport(report);
    return;
  }
  const files = report.files.map((file) => file.path);
  for (const required of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/cli/bin.js",
    "dist/cli/export.js",
    "dist/cli/publish.js",
    "dist/publish/run.js",
    ...GUIDE_FILES,
    "docs/protocol/mokly-upload.md",
    "docs/protocol/mokly-export-ownership.md",
    "docs/protocol/fixtures/export-ownership-v1.json",
    "docs/protocol/mokly-catalogue.md",
    "docs/protocol/fixtures/catalogue-v1.json",
    "dist/catalogue/projection.js",
    "dist/components/definition.js",
    "dist/server/controls/worker.js",
    "dist/build/styles/postcss_worker.js",
    "dist/browser.manifest.json",
    "docs/protocol/mokly-frame-adapter.md",
    "dist/export/run.js",
    "dist/export/transaction.js",
    ...ROOT_FILES,
  ]) {
    assert.ok(files.includes(required), `package is missing ${required}`);
  }
  for (const file of files) {
    assert.ok(
      ROOT_FILES.has(file) ||
        file.startsWith("dist/") ||
        file.startsWith("docs/guides/") ||
        file.startsWith("docs/protocol/"),
      `package contains non-allowlisted path ${file}`,
    );
    assert.equal(file.includes("juno"), false);
  }
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

export function validateViewerReport(report) {
  assert.equal(report.name, "@mokly/viewer");
  assert.match(report.version, /^\d+\.\d+\.\d+$/);
  const files = report.files.map((file) => file.path);
  for (const required of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/server.js",
    "dist/server.d.ts",
    "dist/runtime.js",
    "dist/runtime.d.ts",
    "dist/browser.js",
    "dist/browser.d.ts",
    "dist/browser.manifest.json",
    "dist/data.js",
    "dist/data.d.ts",
    "dist/styles.css",
    "dist/browser/inspector.js",
    "dist/browser/react-shell.js",
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

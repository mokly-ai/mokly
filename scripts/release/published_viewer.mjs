import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { validatePackageReport } from "./archive.mjs";
import { runCommand } from "./command.mjs";

/** Reuse the exact registry archive when the CLI keeps its viewer version. */
export async function downloadViewer(root, destination, execute = runCommand) {
  const { version } = JSON.parse(
    await fs.readFile(path.join(root, "packages/viewer/package.json"), "utf8"),
  );
  await fs.mkdir(destination, { recursive: true });
  const { stdout } = await execute(
    "npm",
    [
      "pack",
      `@mokly/viewer@${version}`,
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      destination,
    ],
    { cwd: root },
  );
  const reports = JSON.parse(stdout);
  assert.equal(reports.length, 1, "npm pack must return one viewer archive");
  const report = reports[0];
  validatePackageReport(report, "@mokly/viewer");
  assert.equal(
    report.version,
    version,
    "registry viewer must match the exact pin",
  );
  assert.equal(path.basename(report.filename), report.filename);
  return { archivePath: path.join(destination, report.filename), report };
}

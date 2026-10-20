import path from "node:path";

import { writeWorkflowOutput } from "./context.mjs";
import { inspectReleaseSet, packReleaseSet } from "./package_set.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const destination = path.resolve(
  root,
  process.argv[2] ?? ".context/release-artifact",
);
const reuse = process.argv[3] === "--reuse";
if (process.argv.length > 4 || (process.argv[3] !== undefined && !reuse))
  throw new Error("usage: pack.mjs {directory} [--reuse]");
const packages = reuse
  ? await inspectReleaseSet(root, destination, {
      reuseViewer: process.env.VIEWER_REF === "",
    })
  : await packReleaseSet(root, destination, {
      reuseViewer: process.env.VIEWER_REF === "",
    });
for (const { archivePath, report } of packages) {
  const prefix = report.name.replace("@mokly/", "").replaceAll("-", "_");
  writeWorkflowOutput(`${prefix}_archive_path`, archivePath);
  writeWorkflowOutput(`${prefix}_version`, report.version);
  process.stdout.write(`Prepared ${archivePath} (${report.integrity}).\n`);
}

import path from "node:path";

import { writeWorkflowOutput } from "./context.mjs";
import { packReleaseSet } from "./package_set.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const destination = path.resolve(
  root,
  process.argv[2] ?? ".context/release-artifact",
);
for (const { archivePath, report } of await packReleaseSet(root, destination)) {
  const prefix = report.name.replace("@mokly/", "").replaceAll("-", "_");
  writeWorkflowOutput(`${prefix}_archive_path`, archivePath);
  writeWorkflowOutput(`${prefix}_version`, report.version);
  process.stdout.write(`Prepared ${archivePath} (${report.integrity}).\n`);
}

import fs from "node:fs";
import path from "node:path";

import { writeWorkflowOutput } from "./context.mjs";
import { packViewer } from "./viewer.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const destination = path.resolve(
  repositoryRoot,
  process.argv[2] ?? ".context/release-artifact",
);
const { archivePath, report } = await packViewer(repositoryRoot, destination);
await fs.promises.writeFile(
  path.join(destination, "viewer/pack-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
writeWorkflowOutput("viewer_archive_path", archivePath);
writeWorkflowOutput("viewer_version", report.version);
process.stdout.write(`Prepared ${archivePath} (${report.integrity}).\n`);

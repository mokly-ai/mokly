import fs from "node:fs";
import path from "node:path";

import { packPackagePair } from "../package/pair.mjs";

import { writeWorkflowOutput } from "./context.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const destination = path.resolve(
  repositoryRoot,
  process.argv[2] ?? ".context/release-artifact",
);
const pair = await packPackagePair(repositoryRoot, destination);
for (const name of ["viewer", "cli"]) {
  const { archivePath, report } = pair[name];
  await fs.promises.writeFile(
    path.join(destination, name, "pack-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeWorkflowOutput(`${name}_archive_path`, archivePath);
  writeWorkflowOutput(`${name}_version`, report.version);
  process.stdout.write(`Prepared ${archivePath} (${report.integrity}).\n`);
}

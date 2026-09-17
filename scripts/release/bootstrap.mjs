import path from "node:path";

import { createBootstrapArchive } from "./bootstrap_archive.mjs";

if (!process.argv[2] || process.argv.length > 5)
  throw new Error(
    "Usage: node scripts/release/bootstrap.mjs <reviewed-full-commit-sha> [new-output-dir] [@mokly/mokly|@mokly/viewer]",
  );

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const { archivePath, report } = await createBootstrapArchive({
  repositoryRoot,
  expectedCommit: process.argv[2],
  packageName: process.argv[4] ?? "@mokly/mokly",
  destination: path.resolve(
    repositoryRoot,
    process.argv[3] ?? ".context/bootstrap-artifact",
  ),
});
process.stdout.write(
  `Prepared ${archivePath}\nSource: ${report.sourceCommit}\nIntegrity: ${report.integrity}\nNothing was published. Inspect pack-report.json before publishing with --tag bootstrap.\n`,
);

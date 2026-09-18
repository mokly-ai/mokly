import fs from "node:fs";
import path from "node:path";

import {
  smokeAccountingFixture,
  smokeCleanCacheExecution,
  smokeEsmConsumer,
  smokeJunoFixture,
  smokeNodeNextConsumer,
} from "./package/consumer_cases.mjs";
import { inspectPackagePair, packPackagePair } from "./package/pair.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const fixturesRoot = path.join(repositoryRoot, "tests/fixtures/consumers");
const contextRoot = path.join(repositoryRoot, ".context");
await fs.promises.mkdir(contextRoot, { recursive: true });
const workingRoot = await fs.promises.mkdtemp(
  path.join(contextRoot, "package-smoke-"),
);

try {
  const packageJson = JSON.parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, "package.json"),
      "utf8",
    ),
  );
  const pair =
    process.argv.length === 2
      ? await packPackagePair(
          repositoryRoot,
          path.join(workingRoot, "artifacts"),
        )
      : await readArtifacts(process.argv.slice(2));
  await inspectPackagePair(pair.cli, pair.viewer);
  const context = {
    archivePath: pair.cli.archivePath,
    viewerArchivePath: pair.viewer.archivePath,
    fixturesRoot,
    packageVersion: pair.cli.report.version,
    viewerVersion: pair.viewer.report.version,
    versions: {
      react: packageJson.devDependencies.react,
      reactDom: packageJson.devDependencies["react-dom"],
      reactDomTypes: packageJson.devDependencies["@types/react-dom"],
      reactTypes: packageJson.devDependencies["@types/react"],
      typescript: packageJson.devDependencies.typescript,
    },
    workingRoot,
  };
  await smokeEsmConsumer(context);
  await smokeNodeNextConsumer(context);
  await smokeCleanCacheExecution(context);
  await smokeAccountingFixture(context);
  await smokeJunoFixture(context);
  process.stdout.write(
    "Both packed packages passed all five consumer scenarios.\n",
  );
} finally {
  await fs.promises.rm(workingRoot, { force: true, recursive: true });
}

async function readArtifacts(args) {
  if (args.length !== 2 || args[0] !== "--artifacts")
    throw new Error(
      "usage: package-smoke.mjs [--artifacts <release-artifact-directory>]",
    );
  const read = async (name) => {
    const directory = path.resolve(args[1], name);
    const report = JSON.parse(
      await fs.promises.readFile(
        path.join(directory, "pack-report.json"),
        "utf8",
      ),
    );
    if (path.basename(report.filename) !== report.filename)
      throw new Error("invalid archive filename");
    return { report, archivePath: path.join(directory, report.filename) };
  };
  return { cli: await read("cli"), viewer: await read("viewer") };
}

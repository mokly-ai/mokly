import fs from "node:fs";
import path from "node:path";

import {
  smokeThemedConsumer,
  smokeCleanCacheExecution,
  smokeEsmConsumer,
  smokeJunoFixture,
  smokeNodeNextConsumer,
} from "./package/consumer_cases.mjs";
import {
  inspectPackagePair,
  packPackagePair,
  readPackagePair,
} from "./package/pair.mjs";

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
  await smokeThemedConsumer(context);
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
  return await readPackagePair(args[1]);
}

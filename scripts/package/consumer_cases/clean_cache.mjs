import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand } from "../command.mjs";
import { consumerPackage } from "../consumer_package.mjs";
import { inspectConsumerExport } from "../export.mjs";
import { copyFixture, initializeGit } from "../fixture.mjs";

export async function smokeCleanCacheExecution(context) {
  const root = path.join(context.workingRoot, "npx-consumer");
  await copyFixture(path.join(context.fixturesRoot, "esm"), root);
  const configPath = path.join(root, "mokly.config.ts");
  await fs.promises.writeFile(
    configPath,
    (await fs.promises.readFile(configPath, "utf8")).replace(
      "export default defineConfig({",
      'export default defineConfig({\n  generatedOutput: "committed",',
    ),
  );
  const packageJson = consumerPackage(
    "clean-cache-npx-consumer",
    context,
    false,
  );
  await fs.promises.writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  await runCommand(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: root },
  );
  assert.equal(
    fs.existsSync(path.join(root, "node_modules/@mokly/mokly")),
    false,
  );
  const cache = path.join(context.workingRoot, "empty-npx-cache");
  const packageSpec = `file:${context.archivePath}`;
  const npx = [
    "exec",
    "--yes",
    "--cache",
    cache,
    "--package",
    packageSpec,
    "--package",
    `file:${context.viewerArchivePath}`,
    "--",
    "mokly",
  ];
  await runCommand("npm", [...npx, "build"], { cwd: root });
  await runCommand("npm", [...npx, "check"], { cwd: root });
  assert.equal(
    fs.existsSync(path.join(root, "mockups/mokly-manifest.json")),
    true,
  );
  await fs.promises.rename(
    path.join(root, "mokly.config.ts"),
    path.join(root, "custom.config.ts"),
  );
  await initializeGit(root);
  await runCommand("git", ["branch", "export-baseline"], { cwd: root });
  const exportArgs = npx.map((arg) =>
    arg === cache ? path.join(context.workingRoot, "empty-export-cache") : arg,
  );
  await runCommand(
    "npm",
    [
      ...exportArgs,
      "export",
      "--config",
      "custom.config.ts",
      "--out",
      "published",
      "--base",
      "export-baseline",
    ],
    { cwd: root },
  );
  await inspectConsumerExport(root, "published", "export-baseline");
  assert.equal(
    fs.existsSync(path.join(root, "node_modules/@mokly/mokly")),
    false,
  );
}

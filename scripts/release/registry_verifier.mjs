import fs from "node:fs";
import path from "node:path";

import { runCommandResult } from "../package/command.mjs";

import {
  comparePublishedPackage,
  isMissingPackage,
} from "./registry_contract.mjs";

const DEFAULT_RETRY_DELAYS = [
  2_000,
  4_000,
  8_000,
  16_000,
  ...Array.from({ length: 9 }, () => 30_000),
];

class RegistryNotReadyError extends Error {
  constructor(message) {
    super(message);
    this.name = "RegistryNotReadyError";
  }
}

/** Verify the checked package against npm, tolerating bounded propagation delay. */
export async function verifyRegistry(options, overrides = {}) {
  const dependencies = {
    execute: runCommandResult,
    retryDelays: DEFAULT_RETRY_DELAYS,
    wait: async (delay) =>
      await new Promise((resolve) => setTimeout(resolve, delay)),
    write: (message) => process.stdout.write(message),
    ...overrides,
  };
  if (options.mode === "guard") {
    return await verifyAttempt(options, dependencies, false);
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await verifyAttempt(options, dependencies, true);
    } catch (error) {
      if (
        !(error instanceof RegistryNotReadyError) ||
        attempt >= dependencies.retryDelays.length
      ) {
        throw error;
      }
      const delay = dependencies.retryDelays[attempt];
      dependencies.write(
        `${error.message}; retrying registry verification in ${delay / 1_000}s ` +
          `(attempt ${attempt + 2}/${dependencies.retryDelays.length + 1}).\n`,
      );
      await dependencies.wait(delay);
    }
  }
}

async function verifyAttempt(options, dependencies, retryPropagation) {
  const { localReport, repositoryRoot } = options;
  const spec = `${localReport.name}@${localReport.version}`;
  const metadataArgs = ["view", spec, "--json"];
  const metadataResult = await dependencies.execute("npm", metadataArgs, {
    cwd: repositoryRoot,
  });
  if (isMissingPackage(metadataResult)) {
    if (retryPropagation) {
      throw new RegistryNotReadyError(`${spec} metadata is not visible on npm`);
    }
    return false;
  }
  requireCommandSuccess("npm", metadataArgs, metadataResult);
  const metadata = JSON.parse(metadataResult.stdout);
  const temporaryRoot = await fs.promises.mkdtemp(
    path.join(repositoryRoot, ".context", "registry-verify-"),
  );
  try {
    const packArgs = [
      "pack",
      spec,
      "--json",
      "--pack-destination",
      temporaryRoot,
    ];
    const packResult = await runRegistryCommand(
      packArgs,
      repositoryRoot,
      dependencies,
      retryPropagation,
      `${spec} tarball is not visible on npm`,
    );
    const reports = JSON.parse(packResult.stdout);
    if (reports.length !== 1) {
      throw new Error(`npm pack returned ${reports.length} reports`);
    }
    const commitArgs = ["rev-parse", "HEAD"];
    const commitResult = await dependencies.execute("git", commitArgs, {
      cwd: repositoryRoot,
    });
    requireCommandSuccess("git", commitArgs, commitResult);
    comparePublishedPackage(
      localReport,
      reports[0],
      metadata,
      commitResult.stdout.trim(),
    );
    if (options.distTag) {
      await verifyDistTag(
        localReport,
        options.distTag,
        repositoryRoot,
        dependencies,
        retryPropagation,
      );
    }
    await verifySignatures(spec, temporaryRoot, dependencies, retryPropagation);
  } finally {
    await fs.promises.rm(temporaryRoot, { force: true, recursive: true });
  }
  return true;
}

async function runRegistryCommand(
  args,
  cwd,
  dependencies,
  retryPropagation,
  missingMessage,
) {
  const result = await dependencies.execute("npm", args, { cwd });
  if (retryPropagation && isMissingPackage(result)) {
    throw new RegistryNotReadyError(missingMessage);
  }
  requireCommandSuccess("npm", args, result);
  return result;
}

async function verifyDistTag(
  report,
  distTag,
  cwd,
  dependencies,
  retryPropagation,
) {
  const result = await runRegistryCommand(
    ["view", report.name, "dist-tags", "--json"],
    cwd,
    dependencies,
    retryPropagation,
    `${report.name} dist-tags are not visible on npm`,
  );
  const tags = JSON.parse(result.stdout);
  if (tags[distTag] === report.version) return;
  const message = `npm dist-tag ${distTag} does not identify ${report.version}`;
  if (retryPropagation) throw new RegistryNotReadyError(message);
  throw new Error(message);
}

async function verifySignatures(
  spec,
  temporaryRoot,
  dependencies,
  retryPropagation,
) {
  await fs.promises.writeFile(
    path.join(temporaryRoot, "package.json"),
    `${JSON.stringify({ name: "mokly-registry-verification", private: true })}\n`,
  );
  await runRegistryCommand(
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-exact",
      spec,
    ],
    temporaryRoot,
    dependencies,
    retryPropagation,
    `${spec} cannot yet be installed from npm`,
  );
  await runRegistryCommand(
    ["audit", "signatures"],
    temporaryRoot,
    dependencies,
    retryPropagation,
    `${spec} signatures are not visible on npm`,
  );
}

function requireCommandSuccess(file, args, result) {
  if (result.code === 0) return;
  throw new Error(
    `${file} ${args.join(" ")} failed\n${result.stdout}${result.stderr}`.trim(),
  );
}

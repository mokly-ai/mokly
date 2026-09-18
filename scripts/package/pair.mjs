import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createPackageArchive,
  inspectDryRun,
  inspectRuntimeLicenses,
} from "./archive.mjs";
import {
  readPackageManifest,
  validateExportFiles,
  validateLockPair,
  validatePackageManifest,
  validateVersionPair,
} from "./manifest.mjs";
import { inspectPackedManifest } from "./packed_manifest.mjs";

/** Pack and check exactly the two archives that consumers and releases use. */
export async function packPackagePair(repositoryRoot, destination) {
  await inspectRuntimeLicenses(repositoryRoot);
  const viewer = await createPackageArchive(
    path.join(repositoryRoot, "packages/viewer"),
    path.join(destination, "viewer"),
    "@mokly/viewer",
  );
  const cli = await createPackageArchive(
    repositoryRoot,
    path.join(destination, "cli"),
  );
  await inspectPackagePair(cli, viewer);
  return { cli, viewer };
}

export async function inspectPackagePair(cli, viewer) {
  const viewerMetadata = await inspectPackedManifest(
    viewer.archivePath,
    viewer.report,
  );
  const cliMetadata = await inspectPackedManifest(cli.archivePath, cli.report);
  validateVersionPair(cliMetadata, viewerMetadata);
}

export async function checkPackagePair(repositoryRoot) {
  const cli = await readPackageManifest(repositoryRoot);
  const viewerRoot = path.join(repositoryRoot, "packages/viewer");
  const viewer = await readPackageManifest(viewerRoot);
  validateVersionPair(cli, viewer);
  const lock = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package-lock.json"), "utf8"),
  );
  validateLockPair(lock, cli, viewer);
  for (const [root, metadata] of [
    [viewerRoot, viewer],
    [repositoryRoot, cli],
  ]) {
    validatePackageManifest(metadata, metadata.name);
    validateExportFiles(metadata, await inspectDryRun(root, metadata.name));
  }
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-package-check-"),
  );
  try {
    await packPackagePair(repositoryRoot, temporary);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

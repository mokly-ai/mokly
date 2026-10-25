import fs from "node:fs/promises";
import path from "node:path";

import {
  createPackageArchive,
  inspectDryRun,
  inspectRuntimeLicenses,
} from "./archive.mjs";
import {
  readPackageManifest,
  validatePackageManifest,
  validateExportFiles,
} from "./manifest.mjs";
import { inspectPackedManifest } from "./packed_manifest.mjs";

/** Check the viewer source contract and its dry-run inventory. */
export async function checkViewerPackage(repositoryRoot) {
  const root = path.join(repositoryRoot, "packages/viewer");
  const manifest = await readPackageManifest(root);
  validatePackageManifest(manifest, "@mokly/viewer");
  validateExportFiles(manifest, await inspectDryRun(root));
}

/** Validate runtime licences and the exact bytes prepared for publication. */
export async function packViewer(repositoryRoot, destination) {
  await inspectRuntimeLicenses(repositoryRoot);
  const packed = await createPackageArchive(
    path.join(repositoryRoot, "packages/viewer"),
    path.join(destination, "viewer"),
  );
  await inspectPackedManifest(packed.archivePath, packed.report);
  return packed;
}

/** Recheck saved archive bytes after smoke testing and before publication. */
export async function inspectViewerArchive(directory) {
  const root = path.resolve(directory, "viewer");
  const report = JSON.parse(
    await fs.readFile(path.join(root, "pack-report.json"), "utf8"),
  );
  if (path.basename(report.filename) !== report.filename)
    throw new Error("invalid archive filename");
  return await inspectPackedManifest(path.join(root, report.filename), report);
}

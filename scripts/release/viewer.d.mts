import type { PackageReport } from "./archive.mjs";
import type { ViewerManifest } from "./manifest.mjs";
export function checkViewerPackage(repositoryRoot: string): Promise<void>;
export function packViewer(
  repositoryRoot: string,
  destination: string,
): Promise<{ archivePath: string; report: PackageReport }>;
export function inspectViewerArchive(
  directory: string,
): Promise<ViewerManifest>;

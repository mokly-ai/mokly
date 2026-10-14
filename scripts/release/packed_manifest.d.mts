import type { PackageReport } from "./archive.mjs";
import type { ViewerManifest } from "./manifest.mjs";
export function inspectPackedManifest(
  archivePath: string,
  report: PackageReport,
): Promise<ViewerManifest>;

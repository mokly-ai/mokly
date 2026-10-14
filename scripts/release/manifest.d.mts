import type { PackageReport } from "./archive.mjs";
export interface ViewerManifest {
  name: string;
  version: string;
  license: string;
  exports: Record<string, string | Record<string, string>>;
  files: string[];
  peerDependencies: Record<string, string>;
  dependencies?: Record<string, string>;
}
export function validatePackageManifest(
  metadata: ViewerManifest,
  name: string,
): void;
export function validateExportFiles(
  metadata: ViewerManifest,
  report: PackageReport,
): void;
export function readPackageManifest(root: string): Promise<ViewerManifest>;

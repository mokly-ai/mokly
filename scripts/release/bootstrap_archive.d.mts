import type { PackageReport } from "./archive.mjs";
import type { packNative } from "./native.mjs";
export function createBootstrapArchive(
  options: {
    repositoryRoot: string;
    expectedCommit: string;
    destination: string;
    packageName?: string;
  },
  dependencies?: { packNative?: typeof packNative },
): Promise<{
  archivePath: string;
  report: PackageReport & {
    sourceCommit: string;
    sourceTree: string;
    binaryVersion?: string;
  };
}>;

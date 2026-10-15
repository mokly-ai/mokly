export interface PackageReport {
  name: string;
  version: string;
  filename: string;
  integrity: string;
  shasum: string;
  files: { path: string; size: number }[];
}

export function createPackageArchive(
  repositoryRoot: string,
  destination: string,
  name?: "@mokly/viewer",
): Promise<{ archivePath: string; report: PackageReport }>;

export function inspectDryRun(
  repositoryRoot: string,
  name?: "@mokly/viewer",
): Promise<PackageReport>;

export function validatePackageReport(
  report: unknown,
  name?: "@mokly/viewer",
): void;

export function inspectRuntimeLicenses(repositoryRoot: string): Promise<void>;

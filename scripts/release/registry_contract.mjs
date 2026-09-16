import { validatePackageReport } from "../package/archive.mjs";

/** Require registry bytes and metadata to match the immutable local artifact. */
export function comparePublishedPackage(local, remote, metadata, commit) {
  validatePackageReport(local, local.name);
  validatePackageReport(remote, local.name);
  for (const key of ["name", "version", "integrity", "shasum"]) {
    if (local[key] !== remote[key]) {
      throw new Error(
        `published package ${key} differs from the checked artifact`,
      );
    }
  }
  if (metadata.gitHead !== undefined && metadata.gitHead !== commit) {
    throw new Error(
      "published package gitHead differs from the immutable tag commit",
    );
  }
  const files = (report) =>
    report.files.map(({ path: filePath, size }) => ({ path: filePath, size }));
  if (JSON.stringify(files(local)) !== JSON.stringify(files(remote))) {
    throw new Error(
      "published package file inventory differs from the checked artifact",
    );
  }
}

/** Distinguish npm's expected missing-version response from network failures. */
export function isMissingPackage(result) {
  return (
    result.code !== 0 &&
    /(?:E404|ETARGET|404 Not Found|No matching version found)/.test(
      `${result.stdout}\n${result.stderr}`,
    )
  );
}

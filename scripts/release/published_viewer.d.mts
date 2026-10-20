import type { PackageReport } from "./archive.mjs";
export function downloadViewer(
  root: string,
  destination: string,
  execute?: (
    file: string,
    args: string[],
    options: { cwd: string },
  ) => Promise<{ stdout: string; stderr: string }>,
): Promise<{ archivePath: string; report: PackageReport }>;

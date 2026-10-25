import type { PackageReport } from "./archive.mjs";
export interface PackedRelease {
  archivePath: string;
  report: PackageReport & { sourceCommit: string; sourceTree: string };
}
export function sourceIdentity(
  root: string,
  ref?: string,
): Promise<{ sourceCommit: string; sourceTree: string }>;
export function savePackage(
  packed: { archivePath: string; report: PackageReport },
  identity: { sourceCommit: string; sourceTree: string },
): Promise<PackedRelease>;
export function inspectReleasePackage(
  root: string,
  directory: string,
  descriptor: { artifact: string; name: string; directory: string },
): Promise<PackedRelease>;
export function inspectReleaseSet(
  root: string,
  directory: string,
): Promise<PackedRelease[]>;
export function packReleaseSet(
  root: string,
  directory: string,
): Promise<PackedRelease[]>;

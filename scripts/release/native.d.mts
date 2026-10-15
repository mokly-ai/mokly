import type { PackedRelease } from "./package_set.mjs";
export function packNative(
  root: string,
  target: string,
  destination: string,
  binaryPath?: string,
): Promise<PackedRelease>;

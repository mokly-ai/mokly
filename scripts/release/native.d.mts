import type { PackedRelease } from "./package_set.mjs";
export function packNative(
  root: string,
  target: string,
  destination: string,
  binaryPath?: string,
  options?: {
    registration?: boolean;
    execute?: (
      file: string,
      args: string[],
      options: { cwd: string; env?: Record<string, string> },
    ) => Promise<{ stdout: string; stderr: string }>;
    inspect?: (binary: string, os: string) => Promise<string>;
  },
): Promise<PackedRelease>;

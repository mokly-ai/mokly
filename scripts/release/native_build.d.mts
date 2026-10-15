import type { NativeTarget } from "./targets.mjs";
export const GLIBC_FLOOR: string;
export const MACOS_FLOOR: string;
export function nativeBuild(
  root: string,
  target: NativeTarget,
  host?: { platform: string; arch: string },
): {
  file: string;
  args: string[];
  options: { cwd: string; env?: Record<string, string> };
  binary: string;
};

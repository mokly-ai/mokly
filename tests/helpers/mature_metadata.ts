import type { TestContext } from "node:test";

import { captureRuntime } from "../../packages/mokly/src/sidecar/capture-runtime.js";
import type { CaptureStat } from "../../packages/mokly/src/sidecar/capture-runtime.js";
import { metadataRuntime } from "../../packages/mokly/src/sidecar/metadata-proof.js";

/** Model an established fixture while retaining real kinds, paths, links, and identities. */
export function matureMetadata(
  context: TestContext,
  realFiles: ReadonlySet<string> = new Set(),
  youngFiles: ReadonlySet<string> = new Set(),
): void {
  const started = captureRuntime.now();
  const stamped = (stat: CaptureStat, stamp: bigint): CaptureStat => ({
    ...stat,
    ctimeNs: stamp,
    mtimeNs: stamp,
    isDirectory: () => stat.isDirectory(),
    isFile: () => stat.isFile(),
    isSymbolicLink: () => stat.isSymbolicLink(),
  });
  context.mock.method(metadataRuntime, "now", () => started);
  for (const method of ["stat", "lstat", "handleStat"] as const)
    context.mock.method(metadataRuntime, method, (file: string) => {
      const stat = captureRuntime[method](file);
      return realFiles.has(file)
        ? stat
        : stamped(
            stat,
            youngFiles.has(file) ? started : started - 3_000_000_001n,
          );
    });
}

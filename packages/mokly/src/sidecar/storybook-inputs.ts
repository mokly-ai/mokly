import type { ModulePaths } from "./module-paths.js";
import { inside } from "./path-scope.js";
import type { PhysicalInputs } from "./physical-inputs.js";

/** Keep the files read by the config loader in the physical and logical recipes. */
export function recordStorybookInputs(
  paths: ModulePaths,
  reads: ReadonlyMap<string, string | null> | undefined,
  physical: Record<string, string | null>,
  logical: Record<string, string | null>,
  evidence?: PhysicalInputs,
): void {
  if (!reads) return;
  for (const [file, digest] of reads) {
    physical[file] = digest;
    if (inside(paths.sourceRoot, file) || paths.dependencyDirectory(file))
      logical[paths.metadataName(file)] = digest;
    if (evidence?.complete) {
      const input = evidence.file(file, true);
      if (
        !(digest === null
          ? input?.kind === "absent"
          : input?.kind === "file" && input.digest === digest)
      )
        evidence.complete = false;
    }
  }
}

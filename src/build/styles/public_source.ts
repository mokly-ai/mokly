/** Prevent imported styles and assets from silently making public files private. */
import { locatePath, type FileLocation } from "../../config/file_locations.js";
import { isInside, projectRealPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";

/** Check public inputs through logical and physical roots, reusing supplied locations. */
export function wouldPrivatizePublicFile(
  file: string,
  config: ResolvedConfig,
  graphInputs: ReadonlySet<string>,
  resolved?: {
    readonly location: FileLocation | undefined;
    readonly mockupsRoot: string;
  },
): boolean {
  const location = resolved
    ? resolved.location
    : locatePath(file, config.repoRoot);
  return (
    !!location &&
    (isInside(config.mockupsDir, location.logicalPath) ||
      isInside(
        resolved?.mockupsRoot ?? projectRealPath(config.mockupsDir),
        location.physicalPath,
      )) &&
    !graphInputs.has(location.logicalPath) &&
    !graphInputs.has(location.physicalPath)
  );
}

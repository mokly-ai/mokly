/** Prevent imported styles and assets from silently making public files private. */
import { locatePath } from "../../config/file_locations.js";
import { isInside, projectRealPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";

/** Check both logical and physical mockups roots before adding an input to inventory. */
export function wouldPrivatizePublicFile(
  file: string,
  config: ResolvedConfig,
  graphInputs: ReadonlySet<string>,
): boolean {
  const location = locatePath(file, config.repoRoot);
  return (
    !!location &&
    (isInside(config.mockupsDir, location.logicalPath) ||
      isInside(projectRealPath(config.mockupsDir), location.physicalPath)) &&
    !graphInputs.has(location.logicalPath) &&
    !graphInputs.has(location.physicalPath)
  );
}

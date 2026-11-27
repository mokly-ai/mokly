import path from "node:path";

import { bareSpecifier } from "./specifier.js";
import type { WorkspaceSources } from "./workspace-sources.js";

export function missingModulePath(
  target: { file: string; name: string },
  specifier: string | undefined,
  packageTarget: string | undefined,
  workspace: WorkspaceSources,
): Error {
  const hintTarget =
    packageTarget ??
    (specifier && bareSpecifier(specifier) && !path.isAbsolute(specifier)
      ? target.file
      : undefined);
  const pkg = hintTarget && workspace.overrideHint(hintTarget);
  const message = `module ${target.name} has no source in this side`;
  return new Error(
    pkg === undefined
      ? message
      : `${message}; set moduleResolution.sourcePackages for ${pkg}`,
  );
}

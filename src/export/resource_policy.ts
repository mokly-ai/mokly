import { projectRealPath } from "../config/paths.js";
import { publicResourceDenial } from "../config/public_denial.js";
import type { ResolvedConfig } from "../config/types.js";

import { exportError } from "./error.js";

/** Snapshot names use lexical policy; current capture additionally resolves aliases. */
export function exportResourcePolicy(
  config: ResolvedConfig,
  resolveAliases = true,
  generated?: ReadonlySet<string>,
): (name: string) => boolean {
  const denial = exportResourceDenial(config, resolveAliases, generated);
  return (name) => denial(name) === undefined;
}

/** Export cannot publish the directory that owns a consumer package. */
export function exportResourceDenial(
  config: ResolvedConfig,
  resolveAliases = true,
  generatedRoutes: ReadonlySet<string> = new Set(),
): (name: string) => string | undefined {
  const mockups = projectRealPath(config.mockupsDir);
  const packages = config.moduleResolution.packageRoots.map(projectRealPath);
  if (packages.includes(mockups))
    throw exportError(
      "A consumer package root must not equal mockupsDir; choose a separate public output directory.",
    );
  return publicResourceDenial(config, resolveAliases, generatedRoutes);
}

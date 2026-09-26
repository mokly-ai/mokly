import path from "node:path";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import {
  publicFileLocation,
  publicFileFailureReason,
} from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

/** Resolve every declaration once, including rules not selected by this render. */
export function validateDeclaredStylesheets(
  entries: readonly ResolvedRegistryEntry[],
  config: ResolvedConfig,
): void {
  const declaredPaths = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== "component") continue;
    const seen = new Set<string>();
    for (const file of entry.stylesheets) {
      const candidate = path.resolve(config.mockupsDir, file);
      const location = publicFileLocation(candidate, config);
      if (!location) {
        throw new MoklyError(
          "build-invalid",
          `component ${entry.id}: stylesheet ${file} is not a public file (${publicFileFailureReason(candidate, config) ?? "missing, non-regular, or outside mockupsDir"})`,
        );
      }
      if (seen.has(location.physicalPath)) continue;
      seen.add(location.physicalPath);
      declaredPaths.add(file);
    }
  }
  if (declaredPaths.size)
    config.componentStylesheetPaths = [...declaredPaths].sort();
  else delete config.componentStylesheetPaths;
}

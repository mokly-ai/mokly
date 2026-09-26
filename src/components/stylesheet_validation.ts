import path from "node:path";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import {
  duplicateComponentStylesheet,
  type BuildWarning,
} from "../build/warnings.js";
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
  onWarning?: (warning: BuildWarning) => void,
): void {
  const declaredPaths = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== "component") continue;
    const firstPaths = new Map<string, string>();
    for (const file of entry.stylesheets) {
      const candidate = path.resolve(config.mockupsDir, file);
      const location = publicFileLocation(candidate, config);
      if (!location) {
        throw new MoklyError(
          "build-invalid",
          `component ${entry.id}: stylesheet ${file} is not a public file (${publicFileFailureReason(candidate, config) ?? "missing, non-regular, or outside mockupsDir"})`,
        );
      }
      const first = firstPaths.get(location.physicalPath);
      if (first !== undefined) {
        onWarning?.(
          duplicateComponentStylesheet(entry.id, location.physicalPath, first),
        );
        continue;
      }
      firstPaths.set(location.physicalPath, file);
      declaredPaths.add(file);
    }
  }
  if (declaredPaths.size)
    config.componentStylesheetPaths = [...declaredPaths].sort();
  else delete config.componentStylesheetPaths;
}

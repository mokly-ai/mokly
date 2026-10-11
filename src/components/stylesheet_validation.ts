import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { type BuildDiagnostic } from "../build/build_warnings.js";
import { duplicateComponentStylesheet } from "../build/warnings.js";
import { PublicFilePolicy } from "../config/public_policy.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { isComponentVariantDefinition } from "./types.js";
/** Resolve every declaration once, including rules not selected by this render. */
export function validateDeclaredStylesheets(
  entries: readonly ResolvedRegistryEntry[],
  config: ResolvedConfig,
  onWarning?: (warning: BuildDiagnostic) => void,
): void {
  const policy = new PublicFilePolicy(config);
  const declaredPaths = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== "component" || isComponentVariantDefinition(entry))
      continue;
    const firstPaths = new Map<string, string>();
    for (const file of entry.stylesheets) {
      const decision = policy.inspect(file);
      if (decision.kind !== "public") {
        throw new MoklyError(
          "build-invalid",
          `component ${entry.path}: stylesheet ${file} is not a public file (${decision.kind === "private" ? decision.reason : "missing, non-regular, or outside mockupsDir"})`,
        );
      }
      const location = decision.location;
      const first = firstPaths.get(location.physicalPath);
      if (first !== undefined) {
        onWarning?.(duplicateComponentStylesheet(entry.path, first));
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

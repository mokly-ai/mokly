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
  const configured = new Map<string, string>();
  const declaredPaths = new Set<string>();
  for (const [index, rule] of config.stylesheets.entries()) {
    for (const file of [
      ...rule.stylesheets,
      ...(rule.lightStylesheets ?? []),
      ...(rule.darkStylesheets ?? []),
    ]) {
      if (/^https?:\/\//.test(file)) continue;
      const location = publicFileLocation(
        path.resolve(config.mockupsDir, file),
        config,
      );
      configured.set(
        location?.physicalPath ?? path.resolve(config.mockupsDir, file),
        `stylesheets[${index}] (${rule.match})`,
      );
    }
  }
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
      if (seen.has(location.physicalPath))
        throw new MoklyError(
          "build-invalid",
          `component ${entry.id}: duplicate stylesheet realpath: ${file}`,
        );
      seen.add(location.physicalPath);
      declaredPaths.add(file);
      const rule = configured.get(location.physicalPath);
      if (rule)
        throw new MoklyError(
          "build-invalid",
          `component ${entry.id}: stylesheet ${file} conflicts with configured ${rule}`,
        );
    }
  }
  if (declaredPaths.size)
    config.componentStylesheetPaths = [...declaredPaths].sort();
  else delete config.componentStylesheetPaths;
}

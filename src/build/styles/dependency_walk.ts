import fs from "node:fs";
import path from "node:path";

import { minimatch } from "minimatch";

import { toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import {
  blocksRequiredInput,
  packageOwnedPath,
} from "../package_owned_paths.js";

/** Walk regular matching files, without following symlinks or denied trees. */
export function walkDependencyDirectory(
  directory: string,
  glob: string,
  config: ResolvedConfig,
): readonly string[] {
  const matches: string[] = [];
  const visit = (current: string): void => {
    const owned = packageOwnedPath(current, config, true);
    if (
      blocksRequiredInput(owned, false) &&
      (owned !== "generated" || config.generatedOutput === "derived")
    )
      return;
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .sort((first, second) => first.name.localeCompare(second.name))) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(candidate);
      } else if (
        entry.isFile() &&
        minimatch(toPosixPath(path.relative(directory, candidate)), glob, {
          dot: true,
          nocase: false,
        })
      )
        if (
          !["review", "cache", "denied", "outside"].includes(
            packageOwnedPath(candidate, config, false) ?? "",
          )
        )
          matches.push(candidate);
    }
  };
  visit(directory);
  return matches.sort();
}

/** Skip external/denied paths before touching source inventory normalization. */
export function ignoredDependencyPath(
  candidate: string,
  config: ResolvedConfig,
): boolean {
  const owned = packageOwnedPath(candidate, config);
  return owned !== undefined && owned !== "generated";
}

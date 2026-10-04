/** Identities for raw source blobs and logical-path-specific stylesheet modules. */

import path from "node:path";

import type { OnResolveArgs } from "esbuild";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { locatePath, type FileLocation } from "../config/file_locations.js";
import { isPackageCode } from "../config/package_code.js";

import {
  installedInteractiveSourceImporter,
  type InteractiveSourceImporter,
} from "./interactive_source_resolution.js";
import { isGraphRuntimePath } from "./source_inventory.js";

/** Normalize installed importers identically in the Node and browser graphs. */
export function installedSourceImporter(
  candidate: string,
  repoRoot: string,
): InteractiveSourceImporter | undefined {
  if (!path.isAbsolute(candidate)) return;
  const location = locatePath(candidate, repoRoot);
  if (
    !location ||
    isGraphRuntimePath(location.physicalPath) ||
    !isPackageCode(candidate, repoRoot)
  )
    return;
  return installedInteractiveSourceImporter(location.relativePath);
}

/** CSS exports depend on the logical path; ordinary raw bytes share physical identity. */
export function capturedSourceKey(location: FileLocation): string {
  return location.logicalPath.endsWith(".css")
    ? location.logicalPath
    : location.physicalPath;
}

/** A CSS symlink must not replace the separate physical path's scoped exports. */
export function capturedSourcePaths(location: FileLocation): readonly string[] {
  return location.logicalPath.endsWith(".css")
    ? [location.relativePath]
    : [location.relativePath, location.physicalRelativePath];
}

/** Preserve a safe authored path alias alongside its resolved graph identity. */
export function resolutionAlias(
  arguments_: OnResolveArgs,
  repoRoot: string,
): string | undefined {
  const absolute = path.isAbsolute(arguments_.path)
    ? arguments_.path
    : arguments_.path.startsWith(".")
      ? path.resolve(
          arguments_.resolveDir || path.dirname(arguments_.importer),
          arguments_.path,
        )
      : undefined;
  if (!absolute) return;
  const relative = path.relative(repoRoot, absolute).split(path.sep).join("/");
  return isSafeRepositoryPath(relative) ? relative : undefined;
}

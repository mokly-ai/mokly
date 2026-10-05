import fs from "node:fs";
import path from "node:path";

import { isOwned } from "../build/ownership.js";
import { isGeneratedRoute } from "../build/styles/routes.js";
import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";
import { isInternalCatalogueFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { exportResourcePolicy } from "../export/resource_policy.js";

/** Missing and unreadable path components share the document's attributed error. */
export function regularDocumentTarget(candidate: string): string | undefined {
  try {
    const real = projectRealPath(candidate);
    return fs.statSync(candidate).isFile() ? real : undefined;
  } catch {
    return undefined;
  }
}

/** Classify existing logical/physical output targets before adding private inputs. */
export function documentTargetKind(
  candidate: string,
  real: string,
  config: ResolvedConfig,
): "generated" | "public" | "source" {
  if (isInternalCatalogueFile(candidate, config)) return "generated";
  const scopes = [
    { file: candidate, config },
    {
      file: real,
      config: { ...config, mockupsDir: projectRealPath(config.mockupsDir) },
    },
  ].filter((scope) => isInside(scope.config.mockupsDir, scope.file));
  for (const scope of scopes) {
    const route = toPosixPath(
      path.relative(scope.config.mockupsDir, scope.file),
    );
    if (isGeneratedRoute(route) || isOwned(scope.file, scope.config))
      return "generated";
  }
  return scopes.some((scope) =>
    exportResourcePolicy(scope.config)(
      toPosixPath(path.relative(scope.config.mockupsDir, scope.file)),
    ),
  )
    ? "public"
    : "source";
}

/** Read copied bytes without exposing raw filesystem paths on a failed read. */
export function readDocumentResource(
  candidate: string,
): Uint8Array | undefined {
  try {
    return new Uint8Array(fs.readFileSync(candidate));
  } catch {
    return undefined;
  }
}

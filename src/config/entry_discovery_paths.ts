import fs from "node:fs";
import path from "node:path";

import { Minimatch } from "minimatch";

import { GENERATED_DIRECTORY } from "../build/styles/routes.js";
import { MoklyError } from "../errors.js";

import { globStablePrefix } from "./entry_globs.js";
import { projectRealPath, toPosixPath } from "./paths.js";
import type { ResolvedConfig } from "./types.js";

/** Repository, Review output, and glob identities retained for one discovery pass. */
export interface DiscoveryPaths {
  readonly repoRoot: string;
  readonly generatedOutput?: {
    readonly lexical: string;
    readonly projected: string;
  };
  readonly realRepoRoot: string;
  readonly reviewOutput: {
    readonly lexical: string;
    readonly projected: string;
  };
  readonly globs: readonly {
    readonly glob: string;
    readonly matcher: Minimatch;
    readonly root: string;
    readonly projected: string;
  }[];
}

/** Project shared roots once, retaining a lexical Review boundary if it is unavailable. */
export function discoveryPaths(
  config: Pick<ResolvedConfig, "entryGlobs" | "repoRoot" | "review"> &
    Partial<Pick<ResolvedConfig, "mockupsDir">>,
): DiscoveryPaths {
  const lexical = path.resolve(config.review.outDir);
  let projected: string;
  try {
    projected = projectRealPath(lexical);
  } catch {
    projected = lexical;
  }
  let realRepoRoot: string;
  try {
    realRepoRoot = fs.realpathSync(config.repoRoot);
  } catch (cause) {
    throw discoveryPathError(config.repoRoot, config.repoRoot, cause);
  }
  const roots = new Map<string, string>([[config.repoRoot, realRepoRoot]]);
  const globs = config.entryGlobs.map((glob) => {
    const root = path.resolve(config.repoRoot, globStablePrefix(glob));
    let realRoot = roots.get(root);
    if (realRoot === undefined) {
      realRoot = root;
      try {
        realRoot = projectRealPath(root);
      } catch (cause) {
        if (!isVanishedDirectory(cause))
          throw discoveryPathError(root, config.repoRoot, cause);
      }
      roots.set(root, realRoot);
    }
    return {
      glob,
      root,
      matcher: new Minimatch(glob, { dot: true }),
      projected: realRoot,
    };
  });
  return {
    repoRoot: config.repoRoot,
    realRepoRoot,
    ...(config.mockupsDir
      ? {
          generatedOutput: {
            lexical: path.join(config.mockupsDir, GENERATED_DIRECTORY),
            projected: generatedRootProjection(config.mockupsDir),
          },
        }
      : {}),
    reviewOutput: { lexical, projected },
    globs,
  };
}

function generatedRootProjection(mockupsDir: string): string {
  const root = path.join(mockupsDir, GENERATED_DIRECTORY);
  try {
    return projectRealPath(root);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" &&
      fs.lstatSync(root, { throwIfNoEntry: false })?.isSymbolicLink()
    )
      return root;
    throw error;
  }
}

/** Only missing or replaced directories are benign races during discovery. */
export function isVanishedDirectory(error: unknown): boolean {
  return isVanishedModule(error) || filesystemErrorCode(error) === "ENOTDIR";
}

/**
 * Only ENOENT is a benign module race. ENOTDIR means a path component became a
 * non-directory, a real change that must remain loud when validating a file.
 */
export function isVanishedModule(error: unknown): boolean {
  return filesystemErrorCode(error) === "ENOENT";
}

/** Preserve the original failure with a repository-relative path and filesystem code. */
export function discoveryPathError(
  candidate: string,
  repoRoot: string,
  cause: unknown,
): MoklyError {
  const relative = toPosixPath(path.relative(repoRoot, candidate)) || ".";
  return new MoklyError(
    "config-invalid",
    `cannot discover entry path ${relative}: ${filesystemErrorCode(cause)}`,
    { cause },
  );
}

/** Uncoded thrown values remain loud and are labelled explicitly in diagnostics. */
function filesystemErrorCode(error: unknown): string {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "unknown";
}

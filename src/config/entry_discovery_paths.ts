import fs from "node:fs";
import path from "node:path";

import { Minimatch } from "minimatch";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

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
  readonly realFiles: Map<string, string>;
  readonly roots: readonly {
    readonly matchers: readonly Minimatch[];
    readonly config: ResolvedConfig["roots"][number];
    readonly root: string;
    readonly projected: string;
  }[];
}

/** Project shared roots once, retaining a lexical Review boundary if it is unavailable. */
export function discoveryPaths(
  config: Pick<ResolvedConfig, "roots" | "repoRoot" | "review"> &
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
  const projectedRoots = new Map<string, string>([
    [config.repoRoot, realRepoRoot],
  ]);
  const roots = config.roots.map((configured) => {
    const root = configured.dir;
    let realRoot = projectedRoots.get(root);
    if (realRoot === undefined) {
      realRoot = root;
      try {
        realRoot = projectRealPath(root);
      } catch (cause) {
        if (!isVanishedDirectory(cause))
          throw discoveryPathError(root, config.repoRoot, cause);
      }
      projectedRoots.set(root, realRoot);
    }
    return {
      config: configured,
      root,
      matchers: configured.files.map(
        (glob) => new Minimatch(glob, { dot: true }),
      ),
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
    roots,
    realFiles: new Map(),
  };
}

function generatedRootProjection(mockupsDir: string): string {
  return path.join(projectRealPath(mockupsDir), GENERATED_DIRECTORY);
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

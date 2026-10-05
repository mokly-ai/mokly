import path from "node:path";

import { isOwned } from "../build/ownership.js";
import { MOKLY_CACHE } from "../config/cache_paths.js";
import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";
import { isMoklyTemporarySegment } from "../config/private_directories.js";
import type { ResolvedConfig } from "../config/types.js";
import { isCancellation } from "../errors.js";
import { reservationNamespace } from "../export/reservation.js";
import type { GitCommandRunner } from "../review/git.js";

import { uncommittedChangesUnavailable } from "./errors.js";

/** Fixed status arguments; user settings cannot hide untracked or submodule changes. */
export const UNCOMMITTED_CHANGES_STATUS: readonly string[] = Object.freeze([
  "--no-optional-locks",
  "status",
  "--porcelain=v1",
  "-z",
  "--untracked-files=all",
  "--ignore-submodules=none",
  "--no-renames",
]);

const STATUS_RECORD = /^[ MTADRCU?!]{2} ./su;

/** Mokly-owned paths whose changes never make a publication dirty. */
export interface MoklyWorkingPaths {
  /** Absolute folders whose contents never count. */
  readonly folders: readonly string[];
  /** Derived output root and the proof that one of its files is Mokly-owned. */
  readonly generated?: {
    readonly root: string;
    owns(candidate: string): boolean;
  };
}

/** Mokly's working paths for one publish that exports to `out`. */
export function moklyWorkingPaths(
  config: ResolvedConfig,
  out: string,
): MoklyWorkingPaths {
  const output = path.resolve(path.dirname(config.configPath), out);
  return {
    folders: [
      output,
      reservationNamespace(output),
      path.join(config.repoRoot, MOKLY_CACHE),
      config.review.outDir,
    ],
    ...(config.generatedOutput === "derived"
      ? {
          generated: {
            root: config.mockupsDir,
            owns: (candidate: string) => isOwned(candidate, config),
          },
        }
      : {}),
  };
}

/** Read whether Git reports a change outside Mokly's working paths. */
export async function readUncommittedChanges(
  runner: GitCommandRunner,
  gitRoot: string,
  working: MoklyWorkingPaths,
): Promise<boolean> {
  try {
    const paths = statusPaths(await runner.run(UNCOMMITTED_CHANGES_STATUS));
    const isWorkingPath = workingPathMatcher(gitRoot, working);
    return paths.some((name) => !isWorkingPath(name));
  } catch (error) {
    if (isCancellation(error)) throw error;
    throw uncommittedChangesUnavailable();
  }
}

/** Every path named by `git status --porcelain=v1 -z` records, except ignored files. */
export function statusPaths(output: string): readonly string[] {
  const fields = output.split("\0");
  if (fields.pop() !== "")
    throw new Error("Git status output is not NUL-terminated");
  const paths: string[] = [];
  for (let index = 0; index < fields.length; index++) {
    const record = fields[index] ?? "";
    if (!STATUS_RECORD.test(record))
      throw new Error("Git status returned an invalid record");
    const status = record.slice(0, 2);
    if (status !== "!!") paths.push(record.slice(3));
    if (/[RC]/u.test(status)) {
      const source = fields[++index];
      if (!source) throw new Error("Git status omitted a rename source");
      paths.push(source);
    }
  }
  return paths;
}

function workingPathMatcher(
  gitRoot: string,
  working: MoklyWorkingPaths,
): (name: string) => boolean {
  const folders = working.folders
    .flatMap((folder) => repositoryForms(gitRoot, folder))
    .filter(Boolean);
  const generated = working.generated
    ? repositoryForms(gitRoot, working.generated.root)
    : [];
  return (name) => {
    const candidate = name.endsWith("/") ? name.slice(0, -1) : name;
    if (candidate.split("/").some(isMoklyTemporarySegment)) return true;
    if (folders.some((folder) => belongsTo(candidate, folder))) return true;
    return generated.some((root) => {
      if (!working.generated || candidate === root) return false;
      if (root !== "" && !belongsTo(candidate, root)) return false;
      const relative =
        root === "" ? candidate : candidate.slice(root.length + 1);
      return working.generated.owns(
        path.join(working.generated.root, ...relative.split("/")),
      );
    });
  };
}

/** Lexical and real forms of `target` relative to the Git top level. */
function repositoryForms(gitRoot: string, target: string): string[] {
  const forms = new Set<string>();
  for (const root of [gitRoot, projectRealPath(gitRoot)])
    for (const candidate of [target, projectRealPath(target)])
      if (isInside(root, candidate))
        forms.add(toPosixPath(path.relative(root, candidate)));
  return [...forms];
}

function belongsTo(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}

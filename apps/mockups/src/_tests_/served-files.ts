/**
 * The state that the served suite records before Serve starts and compares
 * during the suite, after it and after Serve stops: the paths, bytes and times
 * of the build output, and the checkout stamp, which the `mockups:check` test
 * also compares.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  statSync,
} from "node:fs";
import type { Stats } from "node:fs";
import { resolve } from "node:path";

import { outputRoot } from "../../../../docs/mockups/src/_tests_/catalogue-paths";

/** One regular file's SHA-256 and modification time. */
export interface FileStamp {
  sha: string;
  modified: number;
}

/** One symbolic link's target, which Git stores, and modification time. */
export interface LinkStamp {
  link: string;
  modified: number;
}

/**
 * One path that Git lists in a checkout. A directory, such as a nested
 * repository that Git lists as one entry, records only its kind, as does a
 * special file. A listed path that is gone, such as a deleted tracked file,
 * is `missing`.
 */
export type PathStamp =
  FileStamp | LinkStamp | "directory" | "special" | "missing";

/** A checkout's listed files and its ignored paths. */
export interface CheckoutStamp {
  files: Record<string, PathStamp>;
  ignored: string[];
}

/** The repository root. */
export const repositoryRoot = resolve(import.meta.dirname, "../../../..");

/** Where the served suite keeps its records, below the ignored `.context/`. */
export const servedRecords = resolve(repositoryRoot, ".context/mockups-served");

/** The state before Serve started, which the launcher writes. */
export const recordedStateFile = resolve(servedRecords, "before.json");

/** The process id of the Serve command, which the launcher writes. */
export const serveProcessFile = resolve(servedRecords, "serve.json");

/** The exit of the Serve command, which the launcher writes when it exits. */
export const serveExitFile = resolve(servedRecords, "serve-exit.json");

/**
 * The comparison base of the served suite: a ref that no checkout has, so
 * Changes stay unavailable and Serve extracts and installs no base.
 */
export const missingBase = "refs/mokly-cloud/served-tests/missing-base";

/** The SHA-256 and modification time of the regular file at `file`. */
function fileStamp(file: string): FileStamp {
  return {
    sha: createHash("sha256").update(readFileSync(file)).digest("hex"),
    modified: statSync(file).mtimeMs,
  };
}

/**
 * The path, bytes and modification time of every regular file below `root`,
 * in path order, so that even a byte-identical rewrite shows. Symbolic links
 * are not followed, and the `skip` paths are left out.
 */
export function treeStamp(
  root: string,
  skip: readonly string[] = [],
): Record<string, FileStamp> {
  const stamps: [string, FileStamp][] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(resolve(root, directory), {
      withFileTypes: true,
    })) {
      const path = directory ? directory + "/" + entry.name : entry.name;
      if (skip.includes(path)) continue;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile())
        stamps.push([path, fileStamp(resolve(root, path))]);
    }
  };
  visit("");
  return Object.fromEntries(stamps.sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** Whether a file system error says that a path is gone. */
function isGone(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

/**
 * The stamp of one listed path. Only a regular file is read, so a listed path
 * that some process replaced with a FIFO cannot block the stamp.
 */
function pathStamp(file: string): PathStamp {
  let entry: Stats;
  try {
    entry = lstatSync(file);
  } catch (error) {
    if (isGone(error)) return "missing";
    throw error;
  }
  if (entry.isFile()) return fileStamp(file);
  if (entry.isSymbolicLink())
    return { link: readlinkSync(file), modified: entry.mtimeMs };
  return entry.isDirectory() ? "directory" : "special";
}

/**
 * The stamp of the Git checkout at `root`, which a test records before and
 * after a command to prove that the command wrote nothing into the checkout.
 *
 * `files` holds the bytes and time of every path that
 * `git ls-files --cached --others --exclude-standard` lists: each tracked file
 * and each untracked file that Git does not ignore. So a write to an authored
 * source shows even when it keeps the bytes, and a tracked file that is gone
 * shows as `missing`. An author's open edits count only when they change
 * between two stamps.
 *
 * `ignored` lists every ignored path as `git status --ignored=matching` lists
 * it. An ignored directory, such as `node_modules/` or the build output, is
 * one entry, so a new ignored path shows without hashing dependencies.
 *
 * A fixture checkout passes `fixtureGitEnvironment()` as `environment`.
 * Neither Git call takes an optional lock, so a stamp never writes the index.
 */
export function checkoutStamp(
  root: string,
  environment: NodeJS.ProcessEnv,
): CheckoutStamp {
  const git = (...args: string[]) =>
    execFileSync("git", ["--no-optional-locks", ...args], {
      cwd: root,
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024 * 1024,
    }).split("\0");
  // An unmerged path is listed once for each of its stages.
  const listed = new Set(
    git("ls-files", "-z", "--cached", "--others", "--exclude-standard"),
  );
  listed.delete("");
  return {
    files: Object.fromEntries(
      [...listed].sort().map((path) => [path, pathStamp(resolve(root, path))]),
    ),
    ignored: git(
      "status",
      "--porcelain=v1",
      "-z",
      "--ignored=matching",
      "--untracked-files=all",
    )
      .filter((entry) => entry.startsWith("!! "))
      .map((entry) => entry.slice("!! ".length))
      .sort(),
  };
}

/** The build output and the checkout as they are now. */
export function servedState() {
  return {
    output: treeStamp(outputRoot),
    checkout: checkoutStamp(repositoryRoot, process.env),
  };
}

/** The state that the launcher recorded before Serve started. */
export function recordedState(): unknown {
  return JSON.parse(readFileSync(recordedStateFile, "utf8"));
}

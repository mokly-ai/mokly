import fs from "node:fs/promises";
import path from "node:path";

import type { GitCommandRunner } from "../review/git.js";
import { GitProcessError } from "../review/git_process.js";

interface GitProbeFiles {
  realpath(file: string): Promise<string>;
  directory(file: string): Promise<boolean>;
  exists(file: string): Promise<boolean>;
}

export interface GitWorkTreeOptions {
  environment?: NodeJS.ProcessEnv;
  files?: GitProbeFiles;
}

const files: GitProbeFiles = {
  realpath: (file) => fs.realpath(file),
  directory: async (file) => (await fs.stat(file)).isDirectory(),
  async exists(file) {
    try {
      await fs.lstat(file);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  },
};

/** Prove work-tree absence without interpreting localized Git diagnostics. */
export async function insideGitWorkTree(
  root: string,
  runner: GitCommandRunner,
  options: GitWorkTreeOptions = {},
): Promise<boolean> {
  let result: string;
  try {
    result = await runner.run(["rev-parse", "--is-inside-work-tree"]);
  } catch (error) {
    if (
      error instanceof GitProcessError &&
      error.exitCode === 128 &&
      error.signal === null &&
      error.stdout === "" &&
      (await ordinaryDirectory(root, options))
    )
      return false;
    throw error;
  }
  const value = /^(true|false)(?:\r?\n)?$/.exec(result)?.[1];
  if (!value) throw new Error("Git returned an invalid work-tree status");
  return value === "true";
}

async function ordinaryDirectory(
  root: string,
  options: GitWorkTreeOptions,
): Promise<boolean> {
  const environment = options.environment ?? process.env;
  if (
    ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"].some(
      (key) => environment[key] !== undefined,
    )
  )
    return false;
  const probe = options.files ?? files;
  if (!(await probe.directory(root))) return false;
  const visited = new Set<string>();
  for (const start of [path.resolve(root), await probe.realpath(root)]) {
    let current = start;
    while (!visited.has(current)) {
      visited.add(current);
      for (const name of [".git", "HEAD", "objects", "refs"]) {
        if (await probe.exists(path.join(current, name))) return false;
      }
      const parent = path.dirname(current);
      if (current === parent) break;
      current = parent;
    }
  }
  return true;
}

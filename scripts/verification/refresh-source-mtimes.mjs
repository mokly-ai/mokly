import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);

/** Refresh copied working-tree files so a warmup build cannot hide changes. */
export async function refreshChangedSourceMtimes(cwd) {
  const [tracked, untracked] = await Promise.all([
    gitPaths(cwd, [
      "diff",
      "--name-only",
      "--diff-filter=ACMRTUXB",
      "-z",
      "HEAD",
      "--",
    ]),
    gitPaths(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  const paths = [...new Set([...tracked, ...untracked])];
  const timestamp = new Date();
  for (const relative of paths) {
    const file = path.resolve(cwd, relative);
    const metadata = await fs.lstat(file);
    if (!metadata.isFile()) continue;
    await fs.utimes(file, timestamp, timestamp);
  }
  return paths;
}

async function gitPaths(cwd, args) {
  const { stdout } = await execute("git", args, {
    cwd,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout
    .toString("utf8")
    .split("\0")
    .filter((relative) => relative.length > 0);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await refreshChangedSourceMtimes(process.cwd());

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);

/** Fixed actionable output when a checkout cannot be made remote-free. */
export const REMOVE_REMOTE_STATE_ERROR =
  "Could not prepare this checkout for remote-free verification. Run this command in a writable Git repository and try again.";

/** Remove configured remotes and every remaining remote-derived Git input. */
export async function removeRemoteState(directory = process.cwd()) {
  for (const remote of lines(await git(directory, ["remote"])))
    await git(directory, ["remote", "remove", remote]);

  const refs = lines(
    await git(directory, [
      "for-each-ref",
      "--format=%(refname)",
      "refs/remotes/",
    ]),
  );
  for (const ref of refs)
    await git(directory, ["update-ref", "--no-deref", "-d", ref]);

  const fetchHead = resolveGitPath(
    directory,
    await git(directory, ["rev-parse", "--git-path", "FETCH_HEAD"]),
  );
  await fs.rm(fetchHead, { force: true });
  await verifyRemoteFree(directory, fetchHead);
}

async function verifyRemoteFree(directory, fetchHead) {
  const [remotes, refs, config, fetchHeadExists] = await Promise.all([
    git(directory, ["remote"]),
    git(directory, ["for-each-ref", "--format=%(refname)", "refs/remotes/"]),
    git(directory, ["config", "--local", "--name-only", "--list"]),
    exists(fetchHead),
  ]);
  const upstreams = lines(config).filter((name) =>
    /^branch\..+\.(?:remote|merge)$/iu.test(name),
  );
  if (
    lines(remotes).length > 0 ||
    lines(refs).length > 0 ||
    upstreams.length > 0 ||
    fetchHeadExists
  )
    throw new Error("remote Git state remains after cleanup");
}

async function git(directory, arguments_) {
  return (
    await execute("git", arguments_, { cwd: directory, encoding: "utf8" })
  ).stdout.trimEnd();
}

function lines(value) {
  return value.length === 0 ? [] : value.split(/\r?\n/u).filter(Boolean);
}

function resolveGitPath(directory, candidate) {
  return path.isAbsolute(candidate)
    ? candidate
    : path.resolve(directory, candidate);
}

async function exists(candidate) {
  try {
    await fs.lstat(candidate);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function run() {
  try {
    await removeRemoteState();
  } catch {
    process.stderr.write(`${REMOVE_REMOTE_STATE_ERROR}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await run();

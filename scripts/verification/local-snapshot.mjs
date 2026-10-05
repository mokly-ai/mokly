import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const BUFFER_LIMIT = 64 * 1024 * 1024;

/** Keep worker paths independent of the initiating checkout's nesting depth. */
export async function createSnapshotDirectory() {
  const temporary = await fs.realpath(os.tmpdir());
  return fs.mkdtemp(path.join(temporary, "local-check-"));
}

/** Capture both the Git index and actual file bytes, not just HEAD. */
export async function captureSource(root) {
  const [head, names, stagedDiff, mergeHead] = await Promise.all([
    git(root, "rev-parse", "HEAD"),
    git(
      root,
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--deduplicate",
    ),
    git(root, "diff", "--cached", "--binary", "HEAD"),
    readMergeHead(root),
  ]);
  const files = [];
  for (const name of names.split("\0").filter(Boolean).sort()) {
    if (name === ".git" || name.startsWith(".git/"))
      throw new Error("Git inventory contains its own metadata");
    const absolute = path.join(root, name);
    let stat;
    try {
      stat = await fs.lstat(absolute);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      files.push({ name, kind: "link", link: await fs.readlink(absolute) });
    } else if (stat.isFile()) {
      const contents = await fs.readFile(absolute);
      files.push({
        name,
        kind: "file",
        mode: stat.mode & 0o777,
        hash: createHash("sha256").update(contents).digest("hex"),
      });
    } else {
      throw new Error(`Unsupported source entry ${name}`);
    }
  }
  const captured = { head: head.trim(), stagedDiff, mergeHead, files };
  return {
    ...captured,
    fingerprint: createHash("sha256")
      .update(JSON.stringify(captured))
      .digest("hex"),
  };
}

export async function verifySource(root, captured) {
  const observed = await captureSource(root);
  if (observed.fingerprint !== captured.fingerprint)
    throw new Error(
      `Source drift: checkout changed during verification (${root})`,
    );
}

/** Create an independent linked worktree; never stage changes in the owner's checkout. */
export async function createSnapshot(root, captured, owner, label) {
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid snapshot label");
  const snapshot = path.join(owner, label);
  await git(
    root,
    "worktree",
    "add",
    "-q",
    "--detach",
    "--",
    snapshot,
    captured.head,
  );
  try {
    if (captured.stagedDiff.length > 0)
      await applyIndex(snapshot, captured.stagedDiff);
    if (captured.mergeHead !== null) {
      const mergePath = await git(
        snapshot,
        "rev-parse",
        "--git-path",
        "MERGE_HEAD",
      );
      await fs.writeFile(
        path.resolve(snapshot, mergePath.trim()),
        captured.mergeHead,
      );
    }
    const present = new Set(captured.files.map((file) => file.name));
    const original = await git(
      snapshot,
      "ls-tree",
      "-rz",
      "--name-only",
      "HEAD",
    );
    for (const name of original.split("\0").filter(Boolean)) {
      if (!present.has(name))
        await fs.rm(path.join(snapshot, name), { force: true });
    }
    for (const file of captured.files) {
      const target = path.join(snapshot, file.name);
      await ensureParentsAreDirectories(snapshot, file.name);
      await fs.rm(target, { force: true });
      if (file.kind === "link") {
        await fs.symlink(file.link, target);
      } else {
        await fs.copyFile(path.join(root, file.name), target);
        await fs.chmod(target, file.mode);
      }
    }
    await verifySource(snapshot, captured);
    await copyDependencies(root, snapshot);
    return snapshot;
  } catch (error) {
    try {
      await removeSnapshot(root, snapshot, owner);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Snapshot and cleanup failed",
        { cause: cleanupError },
      );
    }
    throw error;
  }
}

/** Keep CSS inputs inside the snapshot and all dependency writes worker-local. */
async function copyDependencies(root, snapshot) {
  const dependencies = path.join(root, "node_modules");
  const destination = path.join(snapshot, "node_modules");
  try {
    await fs.access(dependencies);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  await fs.cp(dependencies, destination, {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
    preserveTimestamps: true,
    verbatimSymlinks: true,
    filter: (source) => source !== path.join(dependencies, ".cache"),
  });
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  );
  for (const directory of manifest.workspaces ?? []) {
    const workspace = JSON.parse(
      await fs.readFile(path.join(root, directory, "package.json"), "utf8"),
    );
    const link = path.join(destination, workspace.name);
    await fs.mkdir(path.dirname(link), { recursive: true });
    await fs.rm(link, { recursive: true, force: true });
    await fs.symlink(path.join(snapshot, directory), link);
  }
}

/** Require explicit ownership before removing a linked worktree. */
export async function removeSnapshot(root, snapshot, owner) {
  if (
    path.dirname(snapshot) !== owner ||
    !path.basename(snapshot).match(/^[a-z0-9-]+$/)
  )
    throw new Error(`Refusing to remove an unowned snapshot: ${snapshot}`);
  const ownerReal = await fs.realpath(owner);
  if (path.dirname(await fs.realpath(snapshot)) !== ownerReal)
    throw new Error(`Snapshot moved outside its owner: ${snapshot}`);
  const listing = await git(root, "worktree", "list", "--porcelain");
  if (!listing.split("\n").includes(`worktree ${snapshot}`))
    throw new Error(`Snapshot is not a registered owned worktree: ${snapshot}`);
  await git(root, "worktree", "remove", "--force", "--", snapshot);
}

async function ensureParentsAreDirectories(root, relative) {
  let current = root;
  for (const part of relative.split("/").slice(0, -1)) {
    current = path.join(current, part);
    await fs.mkdir(current, { recursive: true });
    if (!(await fs.lstat(current)).isDirectory())
      throw new Error(`Snapshot source parent is not a directory: ${current}`);
  }
}

async function applyIndex(root, patch) {
  const child = spawn("git", ["apply", "--cached", "--binary", "-"], {
    cwd: root,
    stdio: ["pipe", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end(patch);
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (code !== 0)
    throw new Error(`Could not reproduce staged index: ${stderr}`);
}

async function git(root, ...args) {
  return (await execute("git", args, { cwd: root, maxBuffer: BUFFER_LIMIT }))
    .stdout;
}

async function readMergeHead(root) {
  const mergePath = await git(root, "rev-parse", "--git-path", "MERGE_HEAD");
  try {
    return await fs.readFile(path.resolve(root, mergePath.trim()), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

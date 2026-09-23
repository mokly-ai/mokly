import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const BUFFER_LIMIT = 64 * 1024 * 1024;

/** Capture both the Git index and actual file bytes, not just HEAD. */
export async function captureSource(root) {
  const [head, names, stagedDiff] = await Promise.all([
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
  const captured = { head: head.trim(), stagedDiff, files };
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
    await linkDependencies(root, snapshot);
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

async function linkDependencies(root, snapshot) {
  const dependencies = path.join(root, "node_modules");
  let entries;
  try {
    entries = await fs.readdir(dependencies, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  );
  const workspaces = new Map();
  for (const directory of manifest.workspaces ?? []) {
    const workspace = JSON.parse(
      await fs.readFile(path.join(root, directory, "package.json"), "utf8"),
    );
    workspaces.set(workspace.name, directory);
  }
  const destination = path.join(snapshot, "node_modules");
  await fs.mkdir(destination);
  for (const entry of entries) {
    if (
      entry.name.startsWith("@") &&
      [...workspaces.keys()].some((name) => name.startsWith(`${entry.name}/`))
    ) {
      const scope = path.join(destination, entry.name);
      await fs.mkdir(scope);
      for (const packageEntry of await fs.readdir(
        path.join(dependencies, entry.name),
      )) {
        const name = `${entry.name}/${packageEntry}`;
        const target = workspaces.has(name)
          ? path.join(snapshot, workspaces.get(name))
          : path.join(dependencies, name);
        await fs.symlink(target, path.join(scope, packageEntry));
      }
    } else {
      await fs.symlink(
        path.join(dependencies, entry.name),
        path.join(destination, entry.name),
      );
    }
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

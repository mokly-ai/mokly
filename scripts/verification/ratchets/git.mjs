import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Parse the NUL-delimited output from `git diff --name-status -z`. */
function parseNameStatus(value) {
  const fields = value.toString("utf8").split("\0");
  const changes = [];
  for (let index = 0; index < fields.length - 1;) {
    const status = fields[index++];
    if (!status) break;
    if (status.startsWith("R") || status.startsWith("C")) {
      const source = fields[index++];
      const path = fields[index++];
      changes.push({ status, source, path });
      continue;
    }
    changes.push({ status, path: fields[index++] });
  }
  return changes;
}

/** Read-only Git boundary shared by repository ratchets. */
export class GitWorkspace {
  constructor(root, target = "origin/main") {
    this.root = root;
    this.target = target;
    this.base = undefined;
  }

  requireBase() {
    if (this.base) return this.base;
    this.#run(["rev-parse", "--verify", "HEAD^{commit}"]);
    const target = this.#run([
      "rev-parse",
      "--verify",
      `${this.target}^{commit}`,
    ])
      .toString("utf8")
      .trim();
    const mergePath = this.#run(["rev-parse", "--git-path", "MERGE_HEAD"])
      .toString("utf8")
      .trim();
    const merging = fs.existsSync(path.resolve(this.root, mergePath));
    const mergeHead = merging
      ? this.#run(["rev-parse", "--verify", "MERGE_HEAD^{commit}"])
          .toString("utf8")
          .trim()
      : undefined;
    if (
      mergeHead &&
      mergeHead !== target &&
      this.#isAncestor(mergeHead, target)
    )
      throw new Error(
        `${this.target} moved during the merge; fetch and merge it again`,
      );
    const base =
      mergeHead === target
        ? mergeHead
        : this.#run(["merge-base", "HEAD", this.target])
            .toString("utf8")
            .trim();
    if (!base)
      throw new Error(
        `Repository ratchet could not resolve the merge base of HEAD and ${this.target}`,
      );
    this.#run(["rev-parse", "--verify", `${base}^{commit}`]);
    this.base = base;
    return base;
  }

  changedFiles(roots) {
    const base = this.requireBase();
    const tracked = parseNameStatus(
      this.#run([
        "diff",
        "--name-status",
        "-z",
        "--find-renames",
        base,
        "--",
        ...roots,
      ]),
    );
    const known = new Set(tracked.map((change) => change.path));
    const untracked = this.#paths([
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...roots,
    ]);
    for (const path of untracked) {
      if (!known.has(path)) tracked.push({ status: "A?", path });
    }
    return tracked;
  }

  currentFiles(roots) {
    return this.#paths([
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...roots,
    ]);
  }

  baseFiles(root) {
    const base = this.requireBase();
    return this.#paths([
      "ls-tree",
      "-r",
      "--name-only",
      "-z",
      base,
      "--",
      root,
    ]);
  }

  readBase(path) {
    return this.readRevision(this.requireBase(), path);
  }

  baseFileExists(path) {
    return this.revisionFileExists(this.requireBase(), path);
  }

  newestReachableTag(pattern) {
    try {
      const tag = this.#run([
        "describe",
        "--tags",
        "--abbrev=0",
        "--match",
        pattern,
        "HEAD",
      ])
        .toString("utf8")
        .trim();
      return tag || undefined;
    } catch (error) {
      if (error instanceof Error && error.cause?.status === 128)
        return undefined;
      throw error;
    }
  }

  readRevision(revision, path) {
    return this.#run(["show", `${revision}:${path}`]);
  }

  revisionFileExists(revision, path) {
    try {
      this.#run(["cat-file", "-e", `${revision}:${path}`]);
      return true;
    } catch {
      return false;
    }
  }

  #paths(args) {
    return this.#run(args).toString("utf8").split("\0").filter(Boolean).sort();
  }

  #isAncestor(ancestor, descendant) {
    try {
      execFileSync(
        "git",
        ["merge-base", "--is-ancestor", ancestor, descendant],
        {
          cwd: this.root,
          stdio: "ignore",
        },
      );
      return true;
    } catch (error) {
      if (error?.status === 1) return false;
      throw error;
    }
  }

  #run(args) {
    try {
      return execFileSync("git", args, {
        cwd: this.root,
        encoding: "buffer",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (cause) {
      const command = `git ${args.join(" ")}`;
      throw new Error(`Repository ratchet command failed: ${command}`, {
        cause,
      });
    }
  }
}

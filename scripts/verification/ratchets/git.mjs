import { execFileSync } from "node:child_process";

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
    this.#run(["rev-parse", "--verify", `${this.target}^{commit}`]);
    const base = this.#run(["merge-base", "HEAD", this.target])
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
    return this.#run(["show", `${this.requireBase()}:${path}`]);
  }

  baseFileExists(path) {
    try {
      this.#run(["cat-file", "-e", `${this.requireBase()}:${path}`]);
      return true;
    } catch {
      return false;
    }
  }

  #paths(args) {
    return this.#run(args).toString("utf8").split("\0").filter(Boolean).sort();
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

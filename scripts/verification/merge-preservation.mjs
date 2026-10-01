import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

function git(...arguments_) {
  return execFileSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trimEnd();
}

function usage() {
  throw new Error(
    "usage: merge-preservation [<merge-commit>] [--result <rev>]",
  );
}

function options(arguments_) {
  let mergeCommit;
  let result;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--result") {
      if (result || !arguments_[index + 1]) usage();
      result = arguments_[++index];
    } else if (!mergeCommit && argument && !argument.startsWith("-")) {
      mergeCommit = argument;
    } else usage();
  }
  return { mergeCommit, result };
}

function mergeSides(selected) {
  const mergePath = git("rev-parse", "--git-path", "MERGE_HEAD");
  const inProgress = fs.existsSync(path.resolve(root, mergePath));
  if (!selected.mergeCommit && inProgress)
    return {
      ours: git("rev-parse", "HEAD"),
      theirs: git("rev-parse", "MERGE_HEAD"),
      result: selected.result ?? "WORKTREE",
    };
  const commit = git(
    "rev-parse",
    "--verify",
    `${selected.mergeCommit ?? "HEAD"}^{commit}`,
  );
  const parents = git("rev-list", "--parents", "-n", "1", commit).split(" ");
  if (parents.length < 3) throw new Error(`${commit} is not a merge commit`);
  return {
    ours: parents[1],
    theirs: parents[2],
    result: selected.result ?? commit,
  };
}

function changedPaths(base, revision) {
  return new Set(
    git("diff", "--name-only", "--no-renames", "-z", base, revision)
      .split("\0")
      .filter(Boolean),
  );
}

function hunks(base, revision, file) {
  const output = git(
    "diff",
    "--no-ext-diff",
    "--no-renames",
    "--unified=0",
    base,
    revision,
    "--",
    file,
  );
  const found = [];
  let current;
  for (const line of output.split("\n")) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/u.exec(line);
    if (header) {
      current = {
        start: Number(header[1]),
        count: Number(header[2] ?? 1),
        added: [],
      };
      found.push(current);
    } else if (current && line.startsWith("+") && !line.startsWith("+++")) {
      current.added.push(line.slice(1));
    }
  }
  return found;
}

function overlaps(first, second) {
  const firstEnd = first.start + Math.max(first.count, 1) - 1;
  const secondEnd = second.start + Math.max(second.count, 1) - 1;
  return first.start <= secondEnd && second.start <= firstEnd;
}

function resultText(revision, file) {
  if (revision === "WORKTREE") {
    const candidate = path.join(root, file);
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? fs.readFileSync(candidate, "utf8")
      : undefined;
  }
  try {
    execFileSync("git", ["cat-file", "-e", `${revision}:${file}`], {
      cwd: root,
      stdio: "ignore",
    });
    return git("show", `${revision}:${file}`);
  } catch {
    return undefined;
  }
}

function collapsed(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function missingPassages(sides) {
  const base = git("merge-base", sides.ours, sides.theirs);
  const theirsPaths = changedPaths(base, sides.theirs);
  const paths = [...changedPaths(base, sides.ours)]
    .filter((file) => theirsPaths.has(file))
    .sort();
  const missing = [];
  for (const file of paths) {
    const result = resultText(sides.result, file);
    if (result === undefined) continue;
    const normalized = collapsed(result);
    const ours = hunks(base, sides.ours, file);
    const theirs = hunks(base, sides.theirs, file);
    for (const [side, source, opposite] of [
      ["ours", ours, theirs],
      ["theirs", theirs, ours],
    ]) {
      for (const hunk of source) {
        if (opposite.some((candidate) => overlaps(hunk, candidate))) continue;
        const added = hunk.added.filter((line) => collapsed(line));
        if (!added.length || normalized.includes(collapsed(added.join("\n"))))
          continue;
        const missingLines = file.endsWith(".md")
          ? added
          : added.filter((line) => !normalized.includes(collapsed(line)));
        if (!missingLines.length) continue;
        const end = hunk.start + Math.max(hunk.count, 1) - 1;
        missing.push({
          file,
          side,
          range: `${hunk.start}-${end}`,
          lines: missingLines.map((line) => line.trim()),
        });
      }
    }
  }
  return { missing, paths: paths.length };
}

function main() {
  const sides = mergeSides(options(process.argv.slice(2)));
  const { missing, paths } = missingPassages(sides);
  if (!missing.length) {
    process.stdout.write(
      `Merge preservation passed for ${paths} overlapping path(s).\n`,
    );
    return;
  }
  process.stderr.write(
    `Merge preservation found ${missing.length} missing one-sided passage(s):\n`,
  );
  for (const item of missing) {
    process.stderr.write(
      `- ${item.file} (${item.side}, base lines ${item.range}):\n`,
    );
    for (const line of item.lines.slice(0, 3))
      process.stderr.write(`    ${line}\n`);
    if (item.lines.length > 3)
      process.stderr.write(`    +${item.lines.length - 3} more\n`);
  }
  process.stderr.write(
    "Restore each passage, or justify its move or removal in the merge commit body.\n",
  );
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
